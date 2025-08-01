# DO GPU Notifier

Real-time GPU availability monitoring for DigitalOcean with push notifications. React frontend + Node.js backend.

## Features

- Real-time monitoring of DigitalOcean GPU availability
- Push notifications when GPUs become available
- Support for L40S, H100-1X, and H100-8X GPU instances
- Configurable regions and user-friendly interface

## Quick Start

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd gpu-cap-ui
   ```

2. **Backend setup**:
   ```bash
   cd backend
   npm install
   ```

3. **Create `.env` file**:
   ```env
   PORT=3001
   DO_API_TOKEN=your_digitalocean_api_token
   VAPID_PUBLIC_KEY=your_vapid_public_key
   VAPID_PRIVATE_KEY=your_vapid_private_key
   VAPID_SUBJECT=mailto:your-email@example.com
   REGIONS_TO_CHECK=nyc1,sfo3,fra1
   ```

4. **Generate VAPID keys**:
   ```bash
   npx web-push generate-vapid-keys
   ```

5. **Frontend setup**:
   ```bash
   cd ../frontend
   npm install
   ```

6. **Run the application**:
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev
   
   # Terminal 2 - Frontend
   cd frontend && npm start
   ```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DO_API_TOKEN` | DigitalOcean API token | Required |
| `VAPID_PUBLIC_KEY` | VAPID public key | Required |
| `VAPID_PRIVATE_KEY` | VAPID private key | Required |
| `REGIONS_TO_CHECK` | Regions to monitor | `nyc1,sfo3,fra1` |

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/status` - Current GPU availability
- `POST /api/status/check` - Manual availability check
- `POST /api/subscription` - Subscribe to notifications
- `GET /api/subscription/:userId` - Get subscription info

## How It Works

1. Backend scheduler checks GPU availability every 100 seconds
2. Uses DigitalOcean's capacity API to monitor regions
3. Sends push notifications when GPUs become available
4. Frontend provides interface for managing preferences

## Troubleshooting

- **API Errors**: Verify DigitalOcean API token permissions
- **Push Notifications**: Check VAPID key configuration
- **Rate Limiting**: System includes delays between API calls

## License

MIT License 