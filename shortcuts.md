# iOS Shortcut Setup Guide

This guide shows you how to build an iOS Shortcut that sends payment data to the NoteManegment server.

## Prerequisites

- iPhone/iPad on the same WiFi network as your Mac running the NoteManegment server
- NoteManegment server running on your Mac (`npm start`)
- The Shortcuts app installed on your iPhone

## Find Your Mac's Local IP Address

On your Mac, open Terminal and run:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Look for the IP under your active network interface (e.g., `192.168.1.100`).

## Create the Shortcut

1. Open the **Shortcuts** app on your iPhone
2. Tap the **"+"** button to create a new shortcut
3. Tap **"Add Action"**
4. Add the following actions **in order**:

### Action 1: Enter Amount
- Tap **"Add Action"** → search for **"Ask for Input"**
- Set **Prompt** to: `Payment amount`
- Set **Input Type** to: `Number`

### Action 2: Enter Merchant
- Tap **"Add Action"** → search for **"Ask for Input"**
- Set **Prompt** to: `Merchant`
- Set **Input Type** to: `Text`

### Action 3: Choose Date
- Tap **"Add Action"** → search for **"Date"** → choose **"Current Date"**
- OR, search for **"Date"** → **"Choose from Menu"** and add a **"Date"** action if you want to pick a different date

### Action 4: Select Payment Method
- Search for **"Choose from Menu"** or **"Choose from List"**
- Add options: `Apple Pay`, `Credit Card`, `Debit Card`, `Cash`, `Venmo`, `Zelle`, `Other`
- Tap **"Add to Home Screen"** (optional - for quick access)

### Action 5: Select Category
- Search for **"Choose from Menu"** or **"Choose from List"**
- Add your common categories: `Food & Drink`, `Transport`, `Shopping`, `Bills`, `Entertainment`, `Work`, `Other`

### Action 6: Enter Tags (Optional)
- Search for **"Ask for Input"**
- Set **Prompt** to: `Tags (comma separated)`
- Set **Input Type** to: `Text`
- Default value: leave empty (optional)

### Action 7: Get Current Date (ISO format)
- Search for **"Date"** → **"Current Date"**
- Then search for **"Format Date"**
- Set **Date** to the variable from the previous step
- Set **Style** to: `ISO 8601`

### Action 8: Combine Tags
- Search for **"Text"** → **"Combine Text"**
- Combine with the tags from the input if provided

### Action 9: Get Variable Details
- Build the JSON body using a **"Text"** action:
```json
{
  "amount": REMEMBER_VALUE_FROM_STEP_1,
  "merchant": REMEMBER_VALUE_FROM_STEP_2,
  "date": FORMATTED_CURRENT_DATE,
  "method": CHOSEN_PAYMENT_METHOD,
  "category": CHOSEN_CATEGORY,
  "tags": SPLIT_TAGS_BY_COMMA
}
```

### Action 10: Send to Server
- Search for **"Get Contents of URL"**
- Set **URL** to: `http://YOUR_MAC_IP:8080/payment`
  - Replace `YOUR_MAC_IP` with the IP found in the prerequisites
  - Default port is `8080`
- Set **Method** to: `POST`
- Under **Headers**, add:
  - Key: `Content-Type`
  - Value: `application/json`
- Under **Request Body**, set to: `JSON`
- Map each field from steps 1-8

### Action 11: Optional - Confirmation
- Search for **"Show Result"**
- Add text like: `Payment noted: Merchant - $Amount`

## Quick Setup

If you prefer a pre-configured shortcut, you can:

1. Save this shortcut URL format for the payment submission:
   ```
   POST http://YOUR_MAC_IP:8080/payment
   Content-Type: application/json
   
   {
     "amount": <number>,
     "merchant": "<string>",
     "date": "<YYYY-MM-DD>",
     "method": "<string>",
     "category": "<string>",
     "tags": ["<string>", ...]
   }
   ```

## Tips

- **Run in background**: Set the shortcut to run in the background by enabling **"Show in Share Sheet"** and **"Use as Quick Action"**
- **Add to Home Screen**: For fastest access, add the shortcut to your iPhone's Home Screen
- **Automations**: You can also trigger this via an Automation (e.g., when you open a specific app after a payment)
- **Port forwarding**: If you want to access the server when not on local WiFi, set up port forwarding on your router or use a tunneling service like ngrok

## Troubleshooting

- **"Connection failed"**: Make sure your Mac and iPhone are on the same WiFi network, and the server is running (`npm start` in the project directory)
- **"Could not connect to server"**: Check that the Mac's firewall isn't blocking port 8080
- **Notion sync fails**: Ensure your `.env` file has valid `NOTION_API_KEY` and `NOTION_DATABASE_ID` values