"""Start the private recognition service; no trained assets are served over HTTP."""
from pathlib import Path
import os
import sys
sys.dont_write_bytecode = True
SERVER = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER / '.recognition-deps'))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from dotenv import load_dotenv
load_dotenv(SERVER / '.env')
import uvicorn

if __name__ == '__main__':
    uvicorn.run('service:app', host=os.getenv('RECOGNITION_HOST', '127.0.0.1'),
                port=int(os.getenv('PORT', '8001')), workers=1, access_log=False)
