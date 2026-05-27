# Security Specification - Petty Cash Koperasi

## Phase 0: Payload-First Security Test-Driven Document

### 1. Data Invariants
- Each **Transaction** must have a non-empty `date`, valid rounded numerical `amount` > 0, non-empty `description`, and a valid `type`.
- If a transaction type is `'transfer'`, both `accountId` and `toAccountId` must be defined and distinct.
- Timestamps must correspond to actual validation logic (`request.time` if updated).
- Users cannot modify or write to collections unless they are authenticated. For simplicity and multi-user access to this shared dashboard, all authenticated users have access to record, edit, or delete entries.

---

### 2. The "Dirty Dozen" Threat Payloads

#### Payload 1: Negative/Invalid Amount Injection
```json
{
  "date": "2026-05-27",
  "description": "Exploit Negative Amount",
  "amount": -500000,
  "type": "expense",
  "categoryId": "cat_1",
  "accountId": "acc_1"
}
```
*Expected: PERMISSION_DENIED*

#### Payload 2: Overly Jumbo Description (Denial of Wallet)
```json
{
  "date": "2026-05-27",
  "description": "A".repeat(10000),
  "amount": 20000,
  "type": "expense",
  "categoryId": "cat_1",
  "accountId": "acc_1"
}
```
*Expected: PERMISSION_DENIED*

#### Payload 3: Invalid Type Enumeration
```json
{
  "date": "2026-05-27",
  "description": "Invalid Type Hack",
  "amount": 10000,
  "type": "malicious_type",
  "categoryId": "cat_1",
  "accountId": "acc_1"
}
```
*Expected: PERMISSION_DENIED*

#### Payload 4: Invalid Field Injection (Shadow Update / Ghost Field)
```json
{
  "date": "2026-05-27",
  "description": "Ghost Field Injection",
  "amount": 10000,
  "type": "expense",
  "categoryId": "cat_1",
  "accountId": "acc_1",
  "isVerifiedByAdmin": true
}
```
*Expected: PERMISSION_DENIED*

#### Payload 5: Transfer with Same Source and Target Account
```json
{
  "date": "2026-05-27",
  "description": "Self Transfer Loop",
  "amount": 25000,
  "type": "transfer",
  "categoryId": "transfer_cat",
  "accountId": "acc_1",
  "toAccountId": "acc_1"
}
```
*Expected: PERMISSION_DENIED*

#### Payload 6: Unauthenticated Transaction Writing
*Any valid payload sent by an unauthenticated client request.*
*Expected: PERMISSION_DENIED*

#### Payload 7: Category with Missing Required Color
```json
{
  "name": "New Cat Without Color",
  "type": "expense",
  "icon": "Tag"
}
```
*Expected: PERMISSION_DENIED*

#### Payload 8: Category with Invalid Color Length
```json
{
  "name": "Vandalized Config",
  "type": "expense",
  "icon": "Tag",
  "color": "#1234567890abcdef"
}
```
*Expected: PERMISSION_DENIED*

#### Payload 9: Account with Giant Description (Denial of Wallet)
```json
{
  "name": "Normal Account",
  "description": "X".repeat(5000)
}
```
*Expected: PERMISSION_DENIED*

#### Payload 10: Invalid Document ID Injection
*Attempting to write to `/transactions/invalid-path-$$$-invalid`.*
*Expected: PERMISSION_DENIED*

#### Payload 11: Transaction with Unrounded Decimal Amount
```json
{
  "date": "2026-05-27",
  "description": "Unrounded decimal float",
  "amount": 42.12837,
  "type": "expense",
  "categoryId": "cat_1",
  "accountId": "acc_1"
}
```
*Expected: PERMISSION_DENIED*

#### Payload 12: Missing Required Field on Creation
```json
{
  "description": "Missing date and category",
  "amount": 10000,
  "type": "expense",
  "accountId": "acc_1"
}
```
*Expected: PERMISSION_DENIED*

---

### 3. Verification Plan
We will define and deploy `firestore.rules` containing schema validation rules to reject any unauthenticated requests or payloads failing our rules constraints.
