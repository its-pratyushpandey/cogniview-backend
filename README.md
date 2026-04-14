# Cogniview - AI-Powered Placement Preparation Platform

> **Latest Update:** Now featuring AI Agentic Tutor with Interview-to-Learning Loop! 🎓

A comprehensive AI-powered platform that prepares, practices, interviews, analyzes, and improves students automatically for placement success.

## 🌟 Core Features

### 🎓 AI Agentic Engineering Tutor ⭐ NEW
- **Adaptive Learning**: AI that adjusts difficulty based on your performance
- **Placement-Focused Teaching**: Interview-style explanations for OS, DBMS, OOPS, CN & DSA
- **Concept Mastery Tracking**: Real-time monitoring of strong and weak concepts
- **Progressive Difficulty**: Dynamic difficulty levels (1-10) that evolve with you
- **Beautiful UI**: Professional interface with smooth Framer Motion animations

### 🔁 Interview → Tutor Loop ⭐ UNIQUE
- **Automatic Weakness Detection**: AI analyzes your interview transcript
- **Smart Recommendations**: Identifies specific topics where you struggled
- **Severity-Based Prioritization**: HIGH/MEDIUM/LOW classification
- **Seamless Transition**: One-click navigation from interview to focused tutoring
- **Continuous Improvement**: Close the loop between practice and learning

### 🎤 AI Voice Interview
- **Realistic AI Interviewer**: Professional voice-based mock interviews
- **Dynamic Follow-ups**: Intelligent follow-up questions based on responses
- **Real-time Feedback**: Instant performance analysis
- **VAPI Integration**: High-quality voice-to-voice communication

### 📊 Comprehensive Analytics
- **Multi-dimensional Scoring**: Evaluation across multiple skill areas
- **Detailed Feedback**: Personalized strengths and improvement areas
- **Progress Tracking**: Monitor improvement over time
- **Interview History**: Complete record of all sessions

### 🎯 Smart Navigation
- **Responsive Menu**: Professional desktop and mobile navigation
- **Quick Access FAB**: Floating action button for instant feature access
- **Active Highlighting**: Visual feedback on current location
- **Badge System**: NEW, VOICE, COMING SOON indicators

### 📱 Modern UX
- **Framer Motion Animations**: Smooth, professional transitions
- **Responsive Design**: Optimized for all devices (mobile-first)
- **Professional Styling**: Clean, modern interface with custom CSS
- **Features Showcase**: Beautiful landing page highlighting all capabilities

## 🛠️ Tech Stack

- **Frontend**: Next.js 15.3.0, React 19, TypeScript
- **Styling**: Custom CSS with CSS Variables, Tailwind CSS
- **Animations**: Framer Motion 12.23.22
- **Backend**: Firebase Admin SDK, Firestore Database
- **Authentication**: Firebase Authentication
- **Voice AI**: VAPI (@vapi-ai/web v2.4.0)
- **AI**: Groq (OpenAI-compatible Chat Completions)
- **Form Handling**: React Hook Form with Zod validation

## 📋 Prerequisites

- Node.js 18+ and npm/pnpm/yarn
- Firebase project with Firestore and Authentication enabled
- VAPI account for voice interview functionality
- Groq API key for AI features

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone <repository-url>
cd Cogniview
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Create a `.env.local` file with:
```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin (Server-side)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY=your_private_key

# Groq API
GROQ_API_KEY=your_groq_api_key

# VAPI (Voice Interview)
NEXT_PUBLIC_VAPI_WEB_TOKEN=your_vapi_token
```

### 4. Start the development server
```bash
npm run dev
```

### 5. Open your browser
Navigate to [http://localhost:3000](http://localhost:3000)

## 📚 Documentation

### Quick Guides
- 🚀 **[Quick Start Guide](./QUICK_START.md)** - Get started in 3 minutes
- 📋 **[Implementation Guide](./AI_TUTOR_IMPLEMENTATION.md)** - Complete feature documentation
- 📊 **[Implementation Summary](./IMPLEMENTATION_SUMMARY.md)** - High-level overview
- ✅ **[Verification Checklist](./VERIFICATION_CHECKLIST.md)** - Testing guide
- 📁 **[File Structure](./FILE_STRUCTURE.md)** - Complete file tree

### Setup Guides
- 🔥 **[Firebase Setup](./FIREBASE_SETUP.md)** - Firebase configuration
- 🎤 **[VAPI Setup](./VAPI_SETUP.md)** - Voice AI setup
- 🚀 **[Deployment Guides](./VERCEL_DEPLOY.md)** - Production deployment

## 🎯 Feature Access

| Feature | URL | Status |
|---------|-----|--------|
| Home Dashboard | `/` | ✅ Live |
| AI Interview | `/interview` | ✅ Live |
| AI Tutor | `/tutor` | ✅ Live |
| Interview Feedback | `/interview/[id]/feedback` | ✅ Live |
| MCQ Practice | `/mcq` | 🚧 Coming Soon |
| Progress Dashboard | `/progress` | 🚧 Coming Soon |

## 🎨 Key Components

### AI Tutor System
```typescript
// Direct access
/tutor

// Pre-filled access (from interview analysis)
/tutor?subject=DBMS&topic=Normalization
```

### Features Showcase
Located on home page, showcases all platform capabilities with animated cards.

### Navigation System
- Desktop: Horizontal navigation bar
- Mobile: Hamburger menu with slide-in animation
- Quick Access: Floating action button (⚡)

## 💻 Development

### Project Structure
```
app/
├── api/
│   ├── tutor/          # AI Tutor API
│   └── interview/      # Interview APIs
├── (root)/
│   ├── tutor/          # AI Tutor page
│   └── interview/      # Interview pages
components/
├── TutorChat.tsx       # Main tutor interface
├── WeaknessModal.tsx   # Analysis modal
├── NavigationMenu.tsx  # Navigation
└── FeaturesShowcase.tsx # Landing showcase
```

### Scripts
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```
   - Create an account and start practicing interviews!

## 📁 Project Structure

```
├── app/                    # Next.js app router
│   ├── (auth)/            # Authentication pages
│   ├── (root)/            # Main application pages
│   └── api/               # API routes
├── components/            # Reusable UI components
│   ├── ui/               # Base UI components
│   ├── Agent.tsx         # VAPI voice integration
│   ├── AuthForm.tsx      # Authentication forms
│   └── ...               # Other components
├── constants/            # Application constants
├── firebase/             # Firebase configuration
├── lib/                  # Utility functions and actions
│   ├── actions/          # Server actions
│   └── vapi.sdk.ts       # VAPI SDK configuration
├── public/               # Static assets
└── types/                # TypeScript type definitions
```

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Firebase Admin SDK (Server-side)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="your_private_key"

# Firebase Client SDK (Client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# VAPI Configuration
NEXT_PUBLIC_VAPI_WEB_TOKEN=your_vapi_web_token
```

## 🎯 How It Works

### 1. Interview Generation Flow
1. User clicks "Generate Interview" on the homepage
2. VAPI voice AI assistant gathers requirements:
   - Job role/position
   - Experience level
   - Interview type preference
   - Relevant tech stack
   - Number of questions
3. AI generates personalized interview questions
4. Questions are saved to Firebase for the interview session

### 2. Interview Conduct Flow
1. User starts an interview session
2. VAPI interviewer AI conducts the interview:
   - Asks prepared questions
   - Listens to responses via voice
   - Provides natural follow-up questions
   - Maintains professional interview atmosphere
3. Interview is recorded and analyzed
4. Comprehensive feedback is generated and stored

### 3. Feedback Analysis
- Multi-dimensional scoring system
- Detailed category-wise evaluation
- Personalized improvement suggestions
- Historical progress tracking

## 📊 Features in Detail

### Voice AI Integration (VAPI)
- **Real-time Voice Processing**: Natural speech-to-text and text-to-speech
- **Conversation Management**: Intelligent conversation flow with context awareness
- **Professional Voice**: High-quality AI voice with professional tone
- **Error Handling**: Graceful fallbacks for connection issues

### Firebase Integration
- **Authentication**: Secure user management with email/password
- **Firestore Database**: Real-time data synchronization
- **Error Boundaries**: Comprehensive error handling with user-friendly messages
- **Responsive Queries**: Optimized database queries with fallback strategies

### User Experience
- **Responsive Design**: Mobile-first approach with desktop optimization
- **Loading States**: Professional loading indicators and skeleton screens
- **Error Handling**: User-friendly error messages and recovery options
- **Accessibility**: WCAG-compliant design patterns

## 🚀 Deployment

### Recommended Platforms
- **Vercel** (recommended): Optimized for Next.js with automatic HTTPS
- **Netlify**: Good alternative with easy deployment
- **Railway**: Full-stack deployment with database support

### Deployment Checklist
- [ ] Set up production Firebase project
- [ ] Configure production VAPI account
- [ ] Set environment variables in deployment platform
- [ ] Enable HTTPS (required for microphone access)
- [ ] Test voice functionality on production domain

## 🔒 Security Considerations

- Environment variables are properly scoped (NEXT_PUBLIC_ for client-side only)
- Firebase security rules configured for user data protection
- VAPI tokens use public keys safe for client-side usage
- Authentication required for all interview features

## 📱 Browser Compatibility

### Supported Browsers
- Chrome 60+ (recommended)
- Firefox 55+
- Safari 11+ (iOS)
- Edge 79+

### Requirements
- Microphone access permission
- HTTPS in production (for microphone access)
- Modern JavaScript support (ES2018+)

## 🐛 Troubleshooting

### Common Issues

1. **Voice not working**:
   - Check microphone permissions
   - Ensure HTTPS in production
   - Verify VAPI token configuration

2. **Firebase errors**:
   - Verify environment variables
   - Check Firebase project settings
   - Review security rules

3. **Authentication issues**:
   - Clear browser cache and cookies
   - Check Firebase Authentication configuration
   - Verify client-side configuration

### Getting Help
- Check browser console for detailed error messages
- Review setup guides (FIREBASE_SETUP.md, VAPI_SETUP.md)
- Verify all environment variables are correctly set

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- VAPI for providing excellent voice AI capabilities
- Firebase for robust backend infrastructure
- Next.js team for the amazing framework
- Google AI for Gemini integration
- All contributors and testers

---

**Ready to practice your next interview?** Get started by following the setup guides and launching your first AI-powered mock interview! 🎤✨
"# Cogniview" 
"# cogniview-backend" 
