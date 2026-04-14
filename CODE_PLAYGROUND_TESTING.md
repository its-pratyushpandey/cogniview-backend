# Code Playground - Testing Guide 🧪

## Quick Test (5 minutes)

### ✅ Basic Functionality Test

1. **Start Server**
   ```bash
   npm run dev
   ```
   Expected: Server starts on http://localhost:3000

2. **Access Page**
   - Navigate to: http://localhost:3000/code-playground
   - Expected: Redirects to sign-in if not authenticated

3. **Sign In**
   - Enter credentials
   - Expected: Redirects back to Code Playground

4. **UI Loads**
   - Check: Problem selector on left
   - Check: Code editor in center
   - Check: Output panel on right
   - Expected: All panels visible and styled

5. **Select Problem**
   - Click "Two Sum" problem
   - Expected: Problem loads, code template appears

6. **Run Code**
   - Click "Run Code" button
   - Expected: Output appears, test results show

7. **Check Animations**
   - Watch entrance animation
   - Hover over buttons
   - Expected: Smooth GSAP and Framer Motion effects

## Detailed Testing (30 minutes)

### 🔧 Feature Tests

#### Test 1: Problem Selection
**Steps:**
1. Search for "Binary"
2. Filter by "Easy" difficulty
3. Select category "Searching"
4. Click on "Binary Search"

**Expected:**
- Search filters results
- Difficulty filter works
- Category filter works
- Problem details display
- Code template loads

**Status:** [ ] Pass [ ] Fail

---

#### Test 2: Python Execution
**Steps:**
1. Select "Two Sum" problem
2. Choose Python language
3. Keep default code
4. Click "Run Code"

**Expected:**
```
Test 1: ✅ PASSED
Test 2: ✅ PASSED
```

**Status:** [ ] Pass [ ] Fail

---

#### Test 3: Java Execution
**Steps:**
1. Switch language to Java
2. Code template updates
3. Click "Run Code"

**Expected:**
- Java template loads
- Compiles successfully
- Tests run
- Output displays

**Status:** [ ] Pass [ ] Fail

---

#### Test 4: C++ Execution
**Steps:**
1. Switch to C++
2. Use template code
3. Run tests

**Expected:**
- C++ code compiles
- Fast execution
- Correct output

**Status:** [ ] Pass [ ] Fail

---

#### Test 5: JavaScript Execution
**Steps:**
1. Switch to JavaScript
2. Test with console.log
3. Run code

**Expected:**
- JS runs correctly
- Console output shown
- Test results accurate

**Status:** [ ] Pass [ ] Fail

---

#### Test 6: Custom Input
**Steps:**
1. Select "Reverse String"
2. Add custom input
3. Run code

**Expected:**
- Custom input used
- Output reflects input
- Test cases still run

**Status:** [ ] Pass [ ] Fail

---

#### Test 7: AI Evaluation
**Steps:**
1. Write working code
2. Click "AI Evaluate"
3. Wait for response

**Expected:**
- Loading indicator shows
- Evaluation appears in 3-8 seconds
- Score, complexity, suggestions displayed
- Metrics animated

**Status:** [ ] Pass [ ] Fail

**Note:** Requires GEMINI_API_KEY in .env.local

---

#### Test 8: Screen Recording
**Steps:**
1. Click "Record Session"
2. Grant screen permission
3. Code for 10 seconds
4. Click "Stop Recording"

**Expected:**
- Permission prompt
- Recording timer shows
- Pulse animation
- File downloads as .webm
- Video playback works

**Status:** [ ] Pass [ ] Fail

**Note:** Works best on Chrome/Edge

---

#### Test 9: Session Save
**Steps:**
1. Write some code
2. Click "Save Session"
3. Check Firestore

**Expected:**
- Success message
- Session saved to Firestore
- Can retrieve later

**Status:** [ ] Pass [ ] Fail

---

#### Test 10: Responsive Design
**Steps:**
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Test: iPhone, iPad, Desktop

**Expected:**
- **Mobile (< 768px)**: Single column, stacked
- **Tablet (768-1279px)**: Adjusted layout
- **Desktop (> 1280px)**: Full 3-panel

**Status:** [ ] Pass [ ] Fail

---

### 🎨 Visual Tests

#### Test 11: Animations
**Check:**
- [x] Entrance animation (GSAP)
- [x] Button hovers (Framer Motion)
- [x] Test pass/fail animations
- [x] Loading spinners
- [x] Tab transitions
- [x] Recording pulse effect

**Status:** [ ] Pass [ ] Fail

---

#### Test 12: Colors & Styling
**Check:**
- [x] Purple primary color (#8b5cf6)
- [x] Green success (#10b981)
- [x] Red errors (#ef4444)
- [x] Proper gradients
- [x] Shadows and borders
- [x] Readable fonts

**Status:** [ ] Pass [ ] Fail

---

### 🐛 Error Handling Tests

#### Test 13: Syntax Error
**Steps:**
1. Write invalid Python code: `print("hello`
2. Run code

**Expected:**
- Syntax error in output
- Red error display
- Clear error message

**Status:** [ ] Pass [ ] Fail

---

#### Test 14: Runtime Error
**Steps:**
1. Write: `print(1/0)`
2. Run code

**Expected:**
- Division by zero error
- Error shown in output
- No app crash

**Status:** [ ] Pass [ ] Fail

---

#### Test 15: Network Error
**Steps:**
1. Disconnect internet
2. Click "Run Code"

**Expected:**
- Error message
- Retry option (via gemini-utils)
- User-friendly error

**Status:** [ ] Pass [ ] Fail

---

#### Test 16: Invalid Test Case
**Steps:**
1. Modify problem test case in DSA_PROBLEMS
2. Run tests

**Expected:**
- Handles gracefully
- Shows comparison
- No crash

**Status:** [ ] Pass [ ] Fail

---

### 🔒 Security Tests

#### Test 17: Authentication
**Steps:**
1. Sign out
2. Try accessing /code-playground

**Expected:**
- Redirects to sign-in
- Cannot access without auth

**Status:** [ ] Pass [ ] Fail

---

#### Test 18: Input Validation
**Steps:**
1. Send malicious code (e.g., fork bomb)
2. Try SQL injection in input

**Expected:**
- Piston sandbox prevents harm
- Input sanitized
- Safe execution

**Status:** [ ] Pass [ ] Fail

---

### ⚡ Performance Tests

#### Test 19: Load Time
**Steps:**
1. Clear cache
2. Navigate to /code-playground
3. Measure time to interactive

**Expected:**
- < 3 seconds on decent connection
- Monaco loads asynchronously
- No blocking

**Status:** [ ] Pass [ ] Fail

---

#### Test 20: Execution Speed
**Steps:**
1. Run simple code (print statement)
2. Note execution time

**Expected:**
- Python: < 2 seconds
- JavaScript: < 1 second
- Java: 2-3 seconds (compilation)
- C++: 1-2 seconds

**Status:** [ ] Pass [ ] Fail

---

## 🎯 Critical Path Test (Must Pass)

### End-to-End Flow
1. **Sign In** → [  ]
2. **Load Page** → [  ]
3. **Select Problem** → [  ]
4. **Write Code** → [  ]
5. **Run Code** → [  ]
6. **See Output** → [  ]
7. **Run Tests** → [  ]
8. **AI Evaluate** → [  ]
9. **Save Session** → [  ]

**All steps must pass for production readiness!**

---

## 🔍 Browser Compatibility

| Browser | Desktop | Mobile | Notes |
|---------|---------|--------|-------|
| Chrome  | ✅ | ✅ | Recommended |
| Edge    | ✅ | ✅ | Best for recording |
| Firefox | ✅ | ⚠️ | Limited recording |
| Safari  | ✅ | ⚠️ | Monaco quirks |

**Test on at least 2 browsers!**

---

## 📝 Test Checklist Summary

### Must Test
- [x] Page loads
- [x] Authentication works
- [ ] Code execution (all 4 languages)
- [ ] AI evaluation
- [ ] Screen recording
- [ ] Session save
- [ ] Responsive design
- [ ] Error handling

### Nice to Test
- [ ] All 8 DSA problems
- [ ] Search & filters
- [ ] Multiple sessions
- [ ] Long running code
- [ ] Large inputs
- [ ] Concurrent users

---

## 🚨 Known Issues (If Any)

### Minor Issues
1. **Monaco Tooltips**: Sometimes overlap on small screens
   - Workaround: Resize window
   
2. **Recording on Firefox**: May not work
   - Workaround: Use Chrome/Edge

3. **Java Compilation**: Takes 2-3 seconds
   - Expected: Normal compilation time

### Fixed Issues
- ✅ TypeScript errors resolved
- ✅ Import issues fixed
- ✅ RecordRTC types installed
- ✅ Build successful

---

## 📊 Test Results

### Test Date: _________________

**Tester:** _________________

**Environment:**
- Node Version: _________________
- Browser: _________________
- OS: _________________

**Overall Status:**
- [ ] All Tests Passed ✅
- [ ] Minor Issues (see notes) ⚠️
- [ ] Major Issues (see notes) ❌

**Notes:**
_______________________________________
_______________________________________
_______________________________________

---

## 🎉 Quick Validation

Just want to verify it works? Run this:

```bash
# 1. Start server
npm run dev

# 2. Open browser
# http://localhost:3000/code-playground

# 3. Try this Python code:
def two_sum(nums, target):
    for i in range(len(nums)):
        for j in range(i+1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []

# 4. Click "Run Code"
# Should see: Test 1: ✅ PASSED, Test 2: ✅ PASSED

# 5. Click "AI Evaluate"
# Should get score and suggestions
```

**If all above works → Feature is READY! 🎉**

---

## 🆘 Troubleshooting

### Server won't start
```bash
# Kill port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F
npm run dev
```

### Monaco won't load
- Check internet connection
- Clear browser cache
- Disable ad blockers

### Code execution fails
- Check Piston API: https://emkc.org/api/v2/piston
- Verify language support
- Check console errors

### AI evaluation timeout
- Verify GEMINI_API_KEY in .env.local
- Check API quota
- Increase timeout in gemini-utils.ts

### Recording not working
- Grant screen share permission
- Use Chrome or Edge
- Check browser console

---

## 📸 Screenshots for Testing

Take screenshots of:
1. Full page layout
2. Problem selector
3. Code editor with syntax highlighting
4. Output panel with results
5. Test cases display
6. AI evaluation panel
7. Recording button active
8. Mobile responsive view

---

**Testing Complete?** Congrats! The Code Playground is production-ready! 🚀
