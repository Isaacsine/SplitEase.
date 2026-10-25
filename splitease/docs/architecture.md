# Prototype architecture

The React ShopProvider manages the split draft and cent-based shares. Local storage preserves the draft but excludes contacts. Supabase optionally provides email/password accounts and tracked request storage with owner-only policies.

QRCode generates invitation images and ZXing reads camera/image QR codes. External merchant QR codes are displayed as unsupported content and never trigger a payment.

PaymentCheckout uses local React state for success/failure previews. These results are never sent to Supabase or a payment gateway. No backend is required by the frontend. The backend folder retains only an optional health scaffold and placeholders for future development.
