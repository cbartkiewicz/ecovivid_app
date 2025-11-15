# EcoVivid

App that determines if an item is recyclable or not using AI-powered image recognition.

## Features

- 📸 **AI-Powered Camera Scanning**: Uses OpenAI Vision API to accurately identify recyclable items from photos
- 🔍 **Manual Search**: Search for items manually if camera scanning isn't available
- 📊 **Impact Tracking**: Track your recycling impact with CO2 savings and landfill diversion
- 📱 **Golden, CO Guidelines**: Localized recycling information for Golden, Colorado

## AI Image Recognition Setup

The app uses OpenAI's GPT-4 Vision API to identify items from camera photos. To enable this feature:

1. **Get an OpenAI API Key**:
   - Sign up at [OpenAI Platform](https://platform.openai.com/)
   - Navigate to [API Keys](https://platform.openai.com/api-keys)
   - Create a new API key

2. **Configure the API Key**:
   - Create a `.env` file in the project root (if it doesn't exist)
   - Add your API key:
     ```
     EXPO_PUBLIC_OPENAI_API_KEY=your_api_key_here
     ```
   - **Important**: Never commit your `.env` file to version control!

3. **Restart the Development Server**:
   - Stop the current server (Ctrl+C)
   - Run `npx expo start --clear` to restart with the new environment variable

## How It Works

1. **Camera Scanning**: 
   - Tap the camera button to scan an item
   - The app captures a photo and sends it to OpenAI Vision API
   - AI identifies the item and matches it against the recycling database
   - Results show recyclability status, category, CO2 savings, and tips

2. **Fallback System**:
   - If AI identification fails, the app will prompt you to search manually
   - The app includes keyword matching as a secondary fallback

## Cost Considerations

- OpenAI API usage is pay-per-use (very affordable for GPT-4o-mini)
- Each image recognition costs approximately $0.001-0.01 depending on image size
- Consider implementing rate limiting or caching for production use

## Development

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Run on iOS device
npx expo run:ios --device

# Run on Android
npx expo run:android
```

## Environment Variables

Create a `.env` file with:
```
EXPO_PUBLIC_OPENAI_API_KEY=sk-your-key-here
```

Make sure `.env` is in your `.gitignore` file!
