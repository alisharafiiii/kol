# How Twitter Account Verification Works

## 🔐 The Verification Process

When a user tries to `/connect` their Twitter account, here's what happens:

### 1. **User Enters Twitter Handle**
- User types `/connect` 
- A modal appears asking for their Twitter handle
- They enter something like `@username` or just `username`

### 2. **Bot Checks Approval Status**
```javascript
// The bot normalizes the handle (lowercase, no @)
const normalizedHandle = handle.toLowerCase().replace('@', '')

// Looks up the user in your KOL database
const userIds = await redis.smembers(`idx:username:${normalizedHandle}`)

// Gets the user data
const userData = await redis.json.get(`user:${userIds[0]}`)

// Checks if approved
const isApproved = userData.approvalStatus === 'approved'
```

### 3. **Verification Requirements**
The user must:
- ✅ Exist in your KOL database
- ✅ Have `approvalStatus: 'approved'`
- ✅ Not be connected to another Discord account

### 4. **If Not Approved**
User gets this message:
```
❌ Your Twitter account is not approved. Please apply through the website first.
```

### 5. **If Approved**
- Connection is created
- User automatically gets "kol" role (unless they have higher role)
- Success message shows

## 🔍 How to Check Who's Approved

### In Your Database:
```bash
# Check if a specific user is approved
redis-cli
> SMEMBERS idx:username:sharafi_eth
> JSON.GET user:[user_id]
```

### Key Fields Checked:
```json
{
  "username": "sharafi_eth",
  "approvalStatus": "approved",  // Must be "approved"
  "role": "admin"                 // Current role
}
```

## 📊 Role Hierarchy

When connecting, users keep their highest role:
- `admin` > `core` > `team` > `kol` > `user`

If a user has role "user" or no role, they get upgraded to "kol" automatically.

## 🚀 Quick Approval Process

1. User applies at: https://kol-qcc8u7yxh-nabus-projects-b8bca9ec.vercel.app
2. Admin approves in admin panel
3. User can immediately `/connect` in Discord

## ❓ Common Issues

### "Not Approved" Error
- User hasn't applied on website
- Admin hasn't approved them yet
- Username mismatch (check exact spelling)

### "Already Connected" Error
- That Twitter account is linked to another Discord user
- Check: `redis-cli GET engagement:twitter:username`

### Connection Works But No Role
- Check if "kol" role exists in Discord server
- Bot needs "Manage Roles" permission
- Role might be higher in hierarchy than bot's role 