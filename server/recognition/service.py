"""Internal HTTP API. Bind to loopback; Express is the only public gateway."""
import asyncio
from contextlib import asynccontextmanager
import math
import os
import secrets
import threading
import time
from functools import lru_cache
from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from starlette.concurrency import run_in_threadpool
from engine import Models, Recognition
from english_words import EnglishWords

@lru_cache(maxsize=1)
def english_words():
    return EnglishWords()

MAX_FRAME = 256 * 1024
TTL = 60
MAX_SESSIONS = 16

class Session:
    def __init__(self, engine):
        self.engine, self.lock = engine, threading.Lock()
        self.touched, self.last_frame = time.monotonic(), -math.inf

class Registry:
    def __init__(self, factory):
        self.factory, self.sessions, self.lock = factory, {}, threading.RLock()
        self.processing = threading.BoundedSemaphore(2)
    def prune(self):
        with self.lock:
            for key, session in list(self.sessions.items()):
                if time.monotonic()-session.touched > TTL and session.lock.acquire(blocking=False):
                    try:
                        self.sessions.pop(key, None); session.engine.close()
                    finally:
                        session.lock.release()
    def create(self):
        self.prune()
        with self.lock:
            if len(self.sessions) >= MAX_SESSIONS:
                raise HTTPException(503, 'Recognition is busy. Try again shortly.')
            key = secrets.token_urlsafe(32)
            self.sessions[key] = Session(self.factory())
            return key
    def use(self, key, action):
        with self.lock:
            session = self.sessions.get(key)
            if not session or time.monotonic()-session.touched > TTL:
                raise HTTPException(410, 'Recognition session expired. Retry recognition.')
            if not session.lock.acquire(blocking=False):
                raise HTTPException(429, 'A frame is already processing.')
            session.touched = time.monotonic()
        try:
            return action(session)
        finally:
            session.lock.release()
    def remove(self, key):
        with self.lock:
            session = self.sessions.get(key)
            if session:
                with session.lock:
                    self.sessions.pop(key, None); session.engine.close()
    def close(self):
        for key in list(self.sessions):
            self.remove(key)

def jpeg_size(data):
    """Check JPEG dimensions before allocating decoded pixels."""
    if not data.startswith(b'\xff\xd8'):
        raise ValueError('Send a JPEG camera frame')
    pos = 2
    while pos + 4 <= len(data):
        if data[pos] != 255:
            break
        while pos < len(data) and data[pos] == 255:
            pos += 1
        if pos >= len(data):
            break
        marker = data[pos]; pos += 1
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            continue
        size = int.from_bytes(data[pos:pos+2], 'big')
        if size < 2 or pos + size > len(data):
            break
        if marker in (0xC0, 0xC1, 0xC2):
            if size < 7:
                break
            height = int.from_bytes(data[pos+3:pos+5], 'big')
            width = int.from_bytes(data[pos+5:pos+7], 'big')
            if not (0 < height <= 1280 and 0 < width <= 1280):
                raise ValueError('Camera frame dimensions exceed the limit')
            return width, height
        pos += size
    raise ValueError('Invalid JPEG camera frame')

def create_app(factory=None, token=None):
    configured_token = token if token is not None else os.getenv('RECOGNITION_INTERNAL_TOKEN', '')
    registry = None
    @asynccontextmanager
    async def lifespan(app):
        nonlocal registry
        if not configured_token:
            raise RuntimeError('RECOGNITION_INTERNAL_TOKEN must be configured')
        models = None if factory else Models()
        registry = Registry(factory or (lambda: Recognition(models)))
        app.state.registry = registry
        async def reap():
            while True:
                await asyncio.sleep(15)
                await run_in_threadpool(registry.prune)
        task = asyncio.create_task(reap())
        try:
            yield
        finally:
            task.cancel()
            await run_in_threadpool(registry.close)
    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    async def authorized(x_recognition_key: str = Header(default='')):
        if not configured_token or not secrets.compare_digest(configured_token, x_recognition_key):
            raise HTTPException(401, 'Unauthorized')
    @app.middleware('http')
    async def no_cache(request, call_next):
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        return response
    @app.post('/sessions', dependencies=[Depends(authorized)])
    async def create():
        key = await run_in_threadpool(registry.create)
        return {'session_id': key}
    @app.post('/nlp/word', dependencies=[Depends(authorized)])
    async def word(request: Request):
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 2048:
                raise HTTPException(413, 'Word input is too large')
        try:
            import json
            data = json.loads(body)
            if not isinstance(data, dict):
                raise ValueError('Send a word')
            return await run_in_threadpool(lambda: english_words().suggest(data.get('text')))
        except (ValueError, TypeError):
            raise HTTPException(422, 'Send 1 to 200 English letters') from None
    @app.post('/nlp/sentence', dependencies=[Depends(authorized)])
    async def sentence(request: Request):
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 8192:
                raise HTTPException(413, 'Sentence input is too large')
        try:
            import json
            data = json.loads(body)
            if not isinstance(data, dict):
                raise ValueError('Send sentence words')
            return await run_in_threadpool(lambda: english_words().sentence(data.get('text'), data.get('fallback')))
        except (ValueError, TypeError):
            raise HTTPException(422, 'Send valid sentence letters and provisional words') from None
    @app.post('/sessions/{key}/frames', dependencies=[Depends(authorized)])
    async def frame(key: str, request: Request, x_frame_timestamp: str = Header(default='')):
        if request.headers.get('content-type', '').split(';')[0] != 'image/jpeg':
            raise HTTPException(415, 'Send an image/jpeg camera frame')
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > MAX_FRAME:
                raise HTTPException(413, 'Camera frame is too large')
        try:
            timestamp = float(x_frame_timestamp)
            if not math.isfinite(timestamp) or timestamp < 0:
                raise ValueError('Invalid frame timestamp')
            jpeg_size(body)
        except (ValueError, TypeError) as error:
            raise HTTPException(422, str(error)) from None
        if not registry.processing.acquire(blocking=False):
            raise HTTPException(429, 'Recognition is busy. Try again shortly.')
        def process():
            def action(session):
                if time.monotonic()-session.last_frame < .04:
                    raise HTTPException(429, 'Camera frames arrived too quickly')
                session.last_frame = time.monotonic()
                return session.engine.process(bytes(body), timestamp)
            return registry.use(key, action)
        try:
            return await run_in_threadpool(process)
        except ValueError as error:
            raise HTTPException(422, str(error)) from None
        finally:
            registry.processing.release()
    @app.post('/sessions/{key}/reset', dependencies=[Depends(authorized)])
    async def reset(key: str):
        await run_in_threadpool(registry.use, key, lambda session: session.engine.reset())
        return {'reset': True}
    @app.delete('/sessions/{key}', dependencies=[Depends(authorized)])
    async def remove(key: str):
        await run_in_threadpool(registry.remove, key)
        return Response(status_code=204)
    return app

app = create_app()
