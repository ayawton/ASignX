import cors from 'cors'
import express from 'express'
import healthRoutes from './routes/health.routes.js'

const app = express()

app.disable('x-powered-by')
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173' }))
app.use(express.json({ limit: '1mb' }))

app.get('/', (_request, response) => {
  response.json({ message: 'Welcome to the ASign API' })
})

app.use('/api/health', healthRoutes)

app.use((_request, response) => {
  response.status(404).json({ message: 'Route not found' })
})

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(error.status || 500).json({ message: error.message || 'Internal server error' })
})

export default app
