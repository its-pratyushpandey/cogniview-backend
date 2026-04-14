// DSA Problem Bank for Code Execution Playground

export const DSA_PROBLEMS: DSAProblem[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    category: "Arrays",
    description: "Given an array of integers nums and an integer target, return indices of the two numbers that add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice.",
    examples: [
      {
        input: "nums = [2,7,11,15], target = 9",
        output: "[0,1]",
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]."
      },
      {
        input: "nums = [3,2,4], target = 6",
        output: "[1,2]",
        explanation: "nums[1] + nums[2] = 6"
      }
    ],
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
      "Only one valid answer exists"
    ],
    testCases: [
      {
        id: "tc1",
        input: "[2, 7, 11, 15]\n9",
        expectedOutput: "[0, 1]",
        isHidden: false,
        weight: 1
      },
      {
        id: "tc2",
        input: "[3, 2, 4]\n6",
        expectedOutput: "[1, 2]",
        isHidden: false,
        weight: 1
      },
      {
        id: "tc3",
        input: "[3,3]\n6",
        expectedOutput: "[0, 1]",
        isHidden: true,
        weight: 1
      }
    ],
    hints: [
      "Use a hash map to store numbers and their indices",
      "For each number, check if target - current number exists in the map",
      "This gives you O(n) time complexity"
    ],
    timeLimit: 2000,
    memoryLimit: 256
  },
  {
    id: "reverse-string",
    title: "Reverse String",
    difficulty: "Easy",
    category: "Strings",
    description: "Write a function that reverses a string. The input string is given as an array of characters s. You must do this by modifying the input array in-place with O(1) extra memory.",
    examples: [
      {
        input: 's = ["h","e","l","l","o"]',
        output: '["o","l","l","e","h"]',
        explanation: "Reverse the string in place"
      }
    ],
    constraints: [
      "1 <= s.length <= 10^5",
      "s[i] is a printable ascii character"
    ],
    testCases: [
      {
        id: "tc1",
        input: '["h","e","l","l","o"]',
        expectedOutput: '["o","l","l","e","h"]',
        isHidden: false,
        weight: 1
      },
      {
        id: "tc2",
        input: '["H","a","n","n","a","h"]',
        expectedOutput: '["h","a","n","n","a","H"]',
        isHidden: false,
        weight: 1
      }
    ],
    hints: [
      "Use two pointers approach",
      "Swap characters from both ends moving towards center"
    ],
    timeLimit: 1000,
    memoryLimit: 128
  },
  {
    id: "max-subarray",
    title: "Maximum Subarray",
    difficulty: "Medium",
    category: "Dynamic Programming",
    description: "Given an integer array nums, find the subarray with the largest sum, and return its sum.",
    examples: [
      {
        input: "nums = [-2,1,-3,4,-1,2,1,-5,4]",
        output: "6",
        explanation: "The subarray [4,-1,2,1] has the largest sum 6"
      },
      {
        input: "nums = [1]",
        output: "1",
        explanation: "The subarray [1] has the largest sum 1"
      }
    ],
    constraints: [
      "1 <= nums.length <= 10^5",
      "-10^4 <= nums[i] <= 10^4"
    ],
    testCases: [
      {
        id: "tc1",
        input: "[-2,1,-3,4,-1,2,1,-5,4]",
        expectedOutput: "6",
        isHidden: false,
        weight: 1
      },
      {
        id: "tc2",
        input: "[1]",
        expectedOutput: "1",
        isHidden: false,
        weight: 1
      },
      {
        id: "tc3",
        input: "[5,4,-1,7,8]",
        expectedOutput: "23",
        isHidden: true,
        weight: 1
      }
    ],
    hints: [
      "Use Kadane's Algorithm",
      "Keep track of current sum and maximum sum",
      "If current sum becomes negative, reset it to 0"
    ],
    timeLimit: 2000,
    memoryLimit: 256
  },
  {
    id: "binary-search",
    title: "Binary Search",
    difficulty: "Easy",
    category: "Searching",
    description: "Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1.",
    examples: [
      {
        input: "nums = [-1,0,3,5,9,12], target = 9",
        output: "4",
        explanation: "9 exists in nums and its index is 4"
      },
      {
        input: "nums = [-1,0,3,5,9,12], target = 2",
        output: "-1",
        explanation: "2 does not exist in nums so return -1"
      }
    ],
    constraints: [
      "1 <= nums.length <= 10^4",
      "-10^4 < nums[i], target < 10^4",
      "All integers in nums are unique",
      "nums is sorted in ascending order"
    ],
    testCases: [
      {
        id: "tc1",
        input: "[-1,0,3,5,9,12]\n9",
        expectedOutput: "4",
        isHidden: false,
        weight: 1
      },
      {
        id: "tc2",
        input: "[-1,0,3,5,9,12]\n2",
        expectedOutput: "-1",
        isHidden: false,
        weight: 1
      }
    ],
    hints: [
      "Use binary search algorithm",
      "Compare middle element with target",
      "Adjust left or right pointer based on comparison"
    ],
    timeLimit: 1000,
    memoryLimit: 128
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Easy",
    category: "Stack",
    description: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid. An input string is valid if: Open brackets must be closed by the same type of brackets. Open brackets must be closed in the correct order.",
    examples: [
      {
        input: 's = "()"',
        output: "true",
        explanation: "Valid parentheses"
      },
      {
        input: 's = "()[]{}"',
        output: "true",
        explanation: "All brackets are properly closed"
      },
      {
        input: 's = "(]"',
        output: "false",
        explanation: "Mismatched brackets"
      }
    ],
    constraints: [
      "1 <= s.length <= 10^4",
      "s consists of parentheses only '()[]{}'."
    ],
    testCases: [
      {
        id: "tc1",
        input: "()",
        expectedOutput: "true",
        isHidden: false,
        weight: 1
      },
      {
        id: "tc2",
        input: "()[]{}",
        expectedOutput: "true",
        isHidden: false,
        weight: 1
      },
      {
        id: "tc3",
        input: "(]",
        expectedOutput: "false",
        isHidden: false,
        weight: 1
      },
      {
        id: "tc4",
        input: "([)]",
        expectedOutput: "false",
        isHidden: true,
        weight: 1
      }
    ],
    hints: [
      "Use a stack data structure",
      "Push opening brackets onto stack",
      "Pop and match when you see closing bracket",
      "Stack should be empty at the end for valid string"
    ],
    timeLimit: 1000,
    memoryLimit: 128
  },
  {
    id: "merge-sorted-arrays",
    title: "Merge Two Sorted Arrays",
    difficulty: "Easy",
    category: "Arrays",
    description: "You are given two integer arrays nums1 and nums2, sorted in non-decreasing order. Merge nums1 and nums2 into a single array sorted in non-decreasing order.",
    examples: [
      {
        input: "nums1 = [1,2,3], nums2 = [2,5,6]",
        output: "[1,2,2,3,5,6]",
        explanation: "The arrays we are merging are [1,2,3] and [2,5,6]"
      }
    ],
    constraints: [
      "nums1.length >= 0",
      "nums2.length >= 0",
      "0 <= nums1[i], nums2[j] <= 10^9"
    ],
    testCases: [
      {
        id: "tc1",
        input: "[1,2,3]\n[2,5,6]",
        expectedOutput: "[1,2,2,3,5,6]",
        isHidden: false,
        weight: 1
      },
      {
        id: "tc2",
        input: "[1]\n[]",
        expectedOutput: "[1]",
        isHidden: false,
        weight: 1
      }
    ],
    hints: [
      "Use two pointers approach",
      "Compare elements from both arrays",
      "Add smaller element to result"
    ],
    timeLimit: 1500,
    memoryLimit: 256
  },
  {
    id: "fibonacci",
    title: "Fibonacci Number",
    difficulty: "Easy",
    category: "Dynamic Programming",
    description: "The Fibonacci numbers form a sequence where each number is the sum of the two preceding ones, starting from 0 and 1. Given n, calculate F(n).",
    examples: [
      {
        input: "n = 2",
        output: "1",
        explanation: "F(2) = F(1) + F(0) = 1 + 0 = 1"
      },
      {
        input: "n = 4",
        output: "3",
        explanation: "F(4) = F(3) + F(2) = 2 + 1 = 3"
      }
    ],
    constraints: [
      "0 <= n <= 30"
    ],
    testCases: [
      {
        id: "tc1",
        input: "2",
        expectedOutput: "1",
        isHidden: false,
        weight: 1
      },
      {
        id: "tc2",
        input: "4",
        expectedOutput: "3",
        isHidden: false,
        weight: 1
      },
      {
        id: "tc3",
        input: "10",
        expectedOutput: "55",
        isHidden: true,
        weight: 1
      }
    ],
    hints: [
      "Can use recursion, but it's inefficient",
      "Dynamic programming gives O(n) solution",
      "Can also use iteration with two variables"
    ],
    timeLimit: 1000,
    memoryLimit: 128
  },
  {
    id: "palindrome-check",
    title: "Valid Palindrome",
    difficulty: "Easy",
    category: "Strings",
    description: "A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Given a string s, return true if it is a palindrome, or false otherwise.",
    examples: [
      {
        input: 's = "A man, a plan, a canal: Panama"',
        output: "true",
        explanation: 'After processing: "amanaplanacanalpanama" is a palindrome'
      },
      {
        input: 's = "race a car"',
        output: "false",
        explanation: '"raceacar" is not a palindrome'
      }
    ],
    constraints: [
      "1 <= s.length <= 2 * 10^5",
      "s consists only of printable ASCII characters"
    ],
    testCases: [
      {
        id: "tc1",
        input: '"A man, a plan, a canal: Panama"',
        expectedOutput: "true",
        isHidden: false,
        weight: 1
      },
      {
        id: "tc2",
        input: '"race a car"',
        expectedOutput: "false",
        isHidden: false,
        weight: 1
      }
    ],
    hints: [
      "Remove non-alphanumeric characters first",
      "Convert to lowercase",
      "Use two pointers from both ends"
    ],
    timeLimit: 1500,
    memoryLimit: 128
  }
];

export const PROBLEM_CATEGORIES = [
  "All",
  "Arrays",
  "Strings",
  "Dynamic Programming",
  "Searching",
  "Sorting",
  "Stack",
  "Queue",
  "Trees",
  "Graphs",
  "Linked List",
  "Hash Table"
];

export const CODE_TEMPLATES: Record<string, Record<string, string>> = {
  python: {
    "two-sum": `def twoSum(nums, target):
    # Write your solution here
    pass

# Test
nums = [2, 7, 11, 15]
target = 9
print(twoSum(nums, target))`,
    "reverse-string": `def reverseString(s):
    # Write your solution here
    pass

# Test
s = ["h","e","l","l","o"]
reverseString(s)
print(s)`,
    "max-subarray": `def maxSubArray(nums):
    # Write your solution here
    pass

# Test
nums = [-2,1,-3,4,-1,2,1,-5,4]
print(maxSubArray(nums))`,
    default: `# Write your Python code here
def solution():
    pass

# Test your code
solution()`
  },
  java: {
    "two-sum": `class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Write your solution here
        return new int[]{};
    }
    
    public static void main(String[] args) {
        Solution sol = new Solution();
        int[] nums = {2, 7, 11, 15};
        int target = 9;
        int[] result = sol.twoSum(nums, target);
        System.out.println("[" + result[0] + ", " + result[1] + "]");
    }
}`,
    default: `class Solution {
    public static void main(String[] args) {
        // Write your Java code here
        System.out.println("Hello World!");
    }
}`
  },
  cpp: {
    "two-sum": `#include <iostream>
#include <vector>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Write your solution here
        return {};
    }
};

int main() {
    Solution sol;
    vector<int> nums = {2, 7, 11, 15};
    int target = 9;
    vector<int> result = sol.twoSum(nums, target);
    cout << "[" << result[0] << ", " << result[1] << "]" << endl;
    return 0;
}`,
    default: `#include <iostream>
using namespace std;

int main() {
    // Write your C++ code here
    cout << "Hello World!" << endl;
    return 0;
}`
  },
  javascript: {
    "two-sum": `function twoSum(nums, target) {
    // Write your solution here
}

// Test
const nums = [2, 7, 11, 15];
const target = 9;
console.log(twoSum(nums, target));`,
    default: `// Write your JavaScript code here
function solution() {
    // Your code
}

// Test your code
solution();`
  }
};
