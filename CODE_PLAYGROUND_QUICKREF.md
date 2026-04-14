# Code Playground - Quick Reference 🚀

## Access
- **URL**: http://localhost:3000/code-playground
- **Route**: `/code-playground`
- **Auth**: Required (auto-redirects to sign-in)

## Components Architecture

```
CodePlayground (Main)
├── CodeProblemSelector (Left Panel)
│   ├── Search & Filters
│   └── Problem List
├── CodeEditor (Center Panel)
│   └── Monaco Editor
└── Output Panel (Right Panel - Tabs)
    ├── Output Tab
    ├── Tests Tab
    └── Evaluation Tab
```

## Key Functions

### Execute Code
```typescript
handleExecute() → /api/code/execute → Piston API → Display Output
```

### Evaluate Code
```typescript
handleEvaluate() → /api/code/evaluate → Gemini AI → Display Analysis
```

### Run Tests
```typescript
runTestCases() → Execute for each test → Compare results → Show pass/fail
```

### Save Session
```typescript
handleSave() → /api/code/sessions → Firestore → Confirmation
```

## API Endpoints

### POST /api/code/execute
**Request:**
```json
{
  "code": "string",
  "language": "python|java|cpp|javascript",
  "input": "string (optional)"
}
```
**Response:**
```json
{
  "success": true,
  "output": "string",
  "executionTime": 123
}
```

### POST /api/code/evaluate
**Request:**
```json
{
  "code": "string",
  "language": "string",
  "problemId": "string",
  "testResults": [...]
}
```
**Response:**
```json
{
  "score": 85,
  "complexity": {...},
  "codeQuality": {...},
  "strengths": [...],
  "suggestions": [...]
}
```

### POST /api/code/sessions
**Request:**
```json
{
  "userId": "string",
  "code": "string",
  "language": "string",
  "problemId": "string",
  "output": "string"
}
```

### GET /api/code/sessions
**Query:** `?userId=xxx` or `?sessionId=xxx`

## Language Support

| Language   | Extension | Piston Version |
|------------|-----------|----------------|
| Python     | .py       | 3.10+          |
| Java       | .java     | 15.0.2+        |
| C++        | .cpp      | 10.2.0+        |
| JavaScript | .js       | 18.15.0+       |

## Problem Categories

- Arrays
- Strings
- Dynamic Programming
- Recursion
- Sorting
- Searching
- Hashing
- Two Pointers

## Difficulty Levels

- 🟢 **Easy**: Beginner-friendly
- 🟡 **Medium**: Moderate challenge
- 🔴 **Hard**: Advanced level

## Keyboard Shortcuts (Future)

- `Ctrl+Enter` - Run code
- `Ctrl+S` - Save session
- `Ctrl+/` - Toggle comment
- `Ctrl+D` - Duplicate line

## Styling Classes

### Custom CSS
```css
.code-playground-container
.problem-selector
.code-editor-wrapper
.output-panel
.test-results
.evaluation-display
.record-btn
```

### Animations
```css
@keyframes code-fade-in
@keyframes test-pass
@keyframes test-fail
@keyframes pulse-glow
```

## Dependencies

```json
{
  "@monaco-editor/react": "4.6.0",
  "recordrtc": "5.6.2",
  "react-split": "2.0.14",
  "@types/recordrtc": "5.6.11"
}
```

## Environment Variables

```env
# Firebase (existing)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=

# Gemini AI (existing)
GEMINI_API_KEY=
```

## Common Issues & Solutions

### Issue: Monaco editor not loading
**Solution**: Check network, ensure CDN access

### Issue: Code execution fails
**Solution**: Check Piston API status, verify language support

### Issue: AI evaluation timeout
**Solution**: Increase timeout in gemini-utils, check API key

### Issue: Recording not starting
**Solution**: Grant screen sharing permission, use Chrome/Edge

### Issue: Test cases not running
**Solution**: Verify problem has test cases, check console errors

## File Paths Reference

```
types/code-playground.d.ts
constants/dsa-problems.ts
app/api/code/execute/route.ts
app/api/code/evaluate/route.ts
app/api/code/sessions/route.ts
components/CodePlayground.tsx
components/CodeEditor.tsx
components/CodeOutput.tsx
components/CodeEvaluationPanel.tsx
components/CodeSessionRecorder.tsx
components/CodeProblemSelector.tsx
app/(root)/code-playground/page.tsx
```

## Testing Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Run production
npm start

# Check types
npx tsc --noEmit

# Lint
npm run lint
```

## Browser DevTools

### Check Network Requests
1. Open DevTools (F12)
2. Network tab
3. Filter: `/api/code/`
4. Check request/response

### Check Console Errors
1. Open Console tab
2. Look for red errors
3. Check stack traces

### Check State
1. React DevTools
2. Find CodePlayground component
3. Inspect state variables

## Performance Tips

1. **Lazy Load Monaco**: Already implemented
2. **Debounce Code Changes**: Consider for auto-save
3. **Cache Problems**: Already in memory
4. **Optimize Test Runs**: Run in parallel (future)
5. **Compress Recordings**: Already using VP9

## Accessibility

- Screen reader support for buttons
- Keyboard navigation (Monaco built-in)
- High contrast mode compatible
- Focus indicators on interactive elements

## Mobile Considerations

- Touch-friendly buttons (larger)
- Simplified layout (single column)
- Virtual keyboard support
- Reduced animations option (future)

## Security Notes

- Code runs in sandboxed environment (Piston)
- No direct shell access
- Input sanitization on API routes
- Firebase security rules enforced
- Rate limiting recommended

## Monitoring

### Key Metrics to Track
- Execution success rate
- Average execution time
- AI evaluation latency
- Session save rate
- User engagement time

### Logs to Monitor
- API request errors
- Piston API failures
- Gemini API timeouts
- Recording failures
- Session save errors

## Backup & Recovery

- Sessions saved in Firestore
- Auto-save (future feature)
- Export code (future feature)
- Session history available

## Future Roadmap

1. **Phase 2**: More problems (30+)
2. **Phase 3**: Code collaboration
3. **Phase 4**: Video playback
4. **Phase 5**: Custom problems
5. **Phase 6**: Leaderboards

---

**Quick Start**: Just go to `/code-playground`, pick a problem, write code, hit "Run Code"! 🎉
