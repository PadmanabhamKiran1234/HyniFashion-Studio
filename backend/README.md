# Hyni Fashion Studio – Backend Phase 1

Node.js + Express + MongoDB Community starter backend for the existing React/Vite frontend.

## Requirements
- Node.js 20 LTS or newer
- MongoDB Community Server running locally
- npm

## Setup
1. Copy this `backend` folder into the root of the extracted `hyni-fashion-studio` frontend project.
2. Open a terminal in the `backend` folder.
3. Install dependencies: `npm install`
4. Check `.env` and make sure the MongoDB URI is `mongodb://127.0.0.1:27017/hyni_fashion_studio`.
5. Start the development server: `npm run dev`
6. Open `http://localhost:5000/api/health`.

## Expected health response
When MongoDB is running, the endpoint returns HTTP 200 and JSON with `success: true`, `api: healthy`, and `database: connected`.

## Scripts
- `npm run dev` – start with nodemon
- `npm start` – start normally

## Phase 1 scope
- Express application and HTTP server
- Local MongoDB connection with Mongoose
- Environment configuration
- CORS for the Vite frontend at `http://localhost:5173`
- Helmet security headers and development request logging
- JSON parsing, 404 handler and centralized error handler
- API and database health endpoint

Authentication, products, orders, payments and employee management are intentionally not included yet; they will be added in later phases.
