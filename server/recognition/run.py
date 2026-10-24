"""Start the private recognition service; no trained assets are served over HTTP."""
from pathlib import Path
import sys
sys.dont_write_bytecode = True
SERVER = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER / '.recognition-deps'))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from dotenv import load_dotenv
load_dotenv(SERVER / '.env')
import uvicorn

if __name__ == '__main__':
    uvicorn.run('service:app', host='127.0.0.1', port=8001, access_log=False)
