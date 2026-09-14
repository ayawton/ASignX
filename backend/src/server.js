import 'dotenv/config'
import app from './app.js'
import { connectDatabase } from './config/database.js'

const port = Number(process.env.PORT) || 5000

try {
  await connectDatabase(process.env.MONGODB_URI)
  app.listen(port, () => {
    console.log(`ASign API listening on http://127.0.0.1:${port}`)
  })
} catch (error) {
  console.error('Unable to start the ASign API:', error)
  process.exit(1)
}
