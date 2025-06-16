#!/bin/bash

echo "Setting up Contracts feature..."

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "Creating .env.local file..."
    touch .env.local
fi

# Check if contracts are already enabled
if grep -q "ENABLE_CONTRACTS" .env.local; then
    echo "Contracts feature is already configured in .env.local"
else
    echo "" >> .env.local
    echo "# Onchain Contracts Feature" >> .env.local
    echo "ENABLE_CONTRACTS=true" >> .env.local
    echo "NEXT_PUBLIC_ENABLE_CONTRACTS=true" >> .env.local
    echo "✅ Added contracts configuration to .env.local"
fi

echo ""
echo "Setup complete! Here's how to test:"
echo ""
echo "1. Restart your development server:"
echo "   npm run dev"
echo ""
echo "2. Create a test contract (admin only):"
echo "   http://localhost:3003/contracts-admin"
echo ""
echo "3. Test the signing page:"
echo "   - The admin page will give you a signing URL"
echo "   - Or use: http://localhost:3003/sign/contract:test123"
echo ""
echo "Note: You need to be logged in as admin to access /contracts-admin" 