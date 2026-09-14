import mongoose from 'mongoose'

export async function connectDatabase(uri) {
  if (!uri) {
    console.warn('MONGODB_URI is not set; the API will run without a database connection.')
    return
  }

  await mongoose.connect(uri)
  console.log('Connected to MongoDB')
}
