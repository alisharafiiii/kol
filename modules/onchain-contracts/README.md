# Onchain Contracts Module

This module provides functionality for creating, signing, and optionally publishing contracts to the blockchain.

## Features

- **Contract Creation**: Admin interface for drafting contracts
- **EIP-712 Signing**: Secure contract signing using typed data
- **Dual Signature**: Support for both admin and user signatures
- **Relay Support**: Placeholder for gasless transactions
- **IPFS Storage**: Placeholder for decentralized storage

## Environment Variables

```env
# Enable contracts feature (required)
ENABLE_CONTRACTS=true
NEXT_PUBLIC_ENABLE_CONTRACTS=true

# Relay configuration (optional)
USE_RELAY=true
RELAY_ENDPOINT=https://your-relay-endpoint.com
RELAY_TOKEN_SECRET=your-relay-secret

# Database (if using Prisma)
DATABASE_URL=postgresql://...
```

## Setup

1. **Enable the feature** by setting environment variables:
   ```bash
   ENABLE_CONTRACTS=true
   NEXT_PUBLIC_ENABLE_CONTRACTS=true
   ```

2. **Run database migration** (if using Prisma):
   ```bash
   npx prisma migrate deploy
   ```

   Or manually run the SQL in `prisma/migrations/add_oc_contracts.sql`

3. **Install dependencies** (if needed):
   ```bash
   npm install ethers wagmi viem
   ```

## Usage

### Admin Interface

Navigate to `/contracts-admin` to:
- Create new contracts
- View existing contracts
- Generate signing links

### Signing Flow

1. Admin creates a contract and shares the signing link
2. User visits `/sign/[contract-id]`
3. User connects wallet and signs with EIP-712
4. Contract is marked as signed when both parties sign

## API Endpoints

- `GET /api/contracts` - List all contracts (admin only)
- `POST /api/contracts` - Create new contract (admin only)
- `GET /api/contracts/[id]` - Get contract details (public)
- `POST /api/contracts/[id]/sign` - Sign a contract (public)

## Architecture

```
modules/onchain-contracts/
├── core/
│   └── index.ts          # Core contract logic
├── components/
│   └── ContractsFeatureGuard.tsx  # Feature flag component
└── README.md
```

## Security Considerations

- All admin routes are protected by authentication
- Signing endpoints verify signatures but currently use mock implementation
- Production implementation should:
  - Use proper EIP-712 signing with ethers.js/viem
  - Verify recovered addresses match signers
  - Implement proper IPFS storage
  - Add rate limiting to prevent spam

## Future Enhancements

1. **Wallet Integration**: Replace mock wallet with wagmi/ethers.js
2. **Chain Publishing**: Implement actual blockchain deployment
3. **IPFS Storage**: Store contract data on IPFS
4. **Relay Integration**: Complete gasless transaction support
5. **Multi-chain Support**: Allow contracts on different chains
6. **Template System**: Pre-defined contract templates
7. **Notification System**: Email/SMS when contracts are signed 