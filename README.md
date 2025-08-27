# BFF Project

This project is a Backend-for-Frontend (BFF) application built using Node.js and Express. It serves as an intermediary between the frontend and various backend services, handling authentication, session management, and API requests.

## Project Structure

- **src/**: Contains the source code for the application.
  - **app.js**: Sets up the Express application, including middleware and route definitions.
  - **server.js**: Entry point of the application, responsible for bootstrapping the Express app and starting the server.
  - **routes/**: Contains route definitions for authentication and API endpoints.
    - **auth.js**: Defines authentication routes such as `/auth/login`, `/auth/callback`, and `/auth/logout`.
    - **api.js**: Contains API routes including `/api/me` and proxy routes for forwarding requests.
    - **health.js**: Defines the health check route `/healthz`.
  - **services/**: Contains business logic and integrations.
    - **sessionStore.js**: Manages Redis session storage, providing functions to set, get, and delete session data.
    - **oidc.js**: Integrates with Authentik for OpenID Connect, handling URL construction and token exchange.
    - **proxy.js**: Contains logic for proxying API requests and injecting access tokens.
  - **middleware/**: Contains middleware functions for request handling.
    - **requireAuth.js**: Protects API routes by checking for a valid session.
    - **csrfCheck.js**: Checks Origin and Referer headers to prevent CSRF attacks.
  - **utils/**: Contains utility functions.
    - **crypto.js**: Provides functions for generating state, nonce, and PKCE code verifiers.
    - **logger.js**: Centralizes logging functionality.
  - **config/**: Loads environment variables and configuration settings for OIDC and Redis.

## Environment Variables

An example of the required environment variables can be found in the `.env.example` file. Ensure to create a `.env` file with your local configuration.

## Docker

To build and run the application using Docker, use the provided `Dockerfile` and `docker-compose.yml` for local development.

## Installation

1. Clone the repository.
2. Install dependencies:
   ```
   npm install
   ```
3. Set up your environment variables in a `.env` file.
4. Start the application:
   ```
   npm start
   ```

## Usage

Access the application at `http://localhost:3000`. The API endpoints are available under `/api` and authentication routes under `/auth`.

## License

This project is licensed under the MIT License.