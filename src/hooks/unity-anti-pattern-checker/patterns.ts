import type { AntiPattern } from "./types"

/**
 * Unity Anti-Patterns
 * 
 * Based on Oracle architecture review recommendations.
 * Patterns are ordered by severity: error > warn > info
 */
export const UNITY_ANTI_PATTERNS: AntiPattern[] = [
  // ============================================
  // CRITICAL ERRORS
  // ============================================
  
  {
    id: "UNT001",
    pattern: /new\s+MonoBehaviour\s*\(/,
    level: "error",
    message: "FATAL: Cannot instantiate MonoBehaviour with 'new'. Use AddComponent<T>() instead.",
  },
  
  {
    id: "UNT002", 
    pattern: /new\s+ScriptableObject\s*\(/,
    level: "error",
    message: "FATAL: Cannot instantiate ScriptableObject with 'new'. Use ScriptableObject.CreateInstance<T>() instead.",
  },
  
  {
    id: "UNT003",
    pattern: /using\s+UnityEditor\s*;/,
    level: "error",
    message: "UnityEditor namespace in runtime code will cause build failures. Wrap with #if UNITY_EDITOR.",
    condition: (ctx) => !ctx.isEditorScript,
  },

  // ============================================
  // PERFORMANCE WARNINGS
  // ============================================
  
  {
    id: "UNT010",
    pattern: /void\s+(Update|FixedUpdate|LateUpdate)\s*\([^)]*\)\s*\{[^}]*GetComponent\s*</,
    level: "warn",
    message: "GetComponent<T>() in Update loop is expensive. Cache the reference in Awake() or Start().",
  },
  
  {
    id: "UNT011",
    pattern: /void\s+(Update|FixedUpdate|LateUpdate)\s*\([^)]*\)\s*\{[^}]*FindObject/,
    level: "warn", 
    message: "FindObjectOfType in Update loop scans entire scene. Cache the reference in Start().",
  },
  
  {
    id: "UNT012",
    pattern: /void\s+(Update|FixedUpdate|LateUpdate)\s*\([^)]*\)\s*\{[^}]*Camera\.main/,
    level: "warn",
    message: "Camera.main internally calls FindGameObjectsWithTag every time. Cache the reference.",
  },
  
  {
    id: "UNT013",
    pattern: /void\s+(Update|FixedUpdate|LateUpdate)\s*\([^)]*\)\s*\{[^}]*Resources\.Load/,
    level: "warn",
    message: "Resources.Load in Update causes synchronous I/O. Load assets in Awake/Start instead.",
  },
  
  {
    id: "UNT014",
    pattern: /void\s+(Update|FixedUpdate|LateUpdate)\s*\([^)]*\)\s*\{[^}]*GameObject\.Find\s*\(/,
    level: "warn",
    message: "GameObject.Find in Update is O(n) per frame. Use serialized reference or cache in Start().",
  },
  
  {
    id: "UNT015",
    pattern: /\.tag\s*==\s*"/,
    level: "warn",
    message: "Use CompareTag() instead of tag == for better performance (avoids string allocation).",
  },
  
  {
    id: "UNT016",
    pattern: /void\s+(Update|FixedUpdate|LateUpdate)\s*\(\s*\)\s*\{\s*\}/,
    level: "warn",
    message: "Empty Update/FixedUpdate/LateUpdate still has invocation overhead. Remove if unused.",
  },
  
  {
    id: "UNT017",
    pattern: /async\s+void\s+(?!(Start|Awake|OnEnable|OnDisable|OnDestroy)\s*\()/,
    level: "warn",
    message: "async void swallows exceptions silently. Use async UniTask or async Task instead.",
  },
  
  {
    id: "UNT018",
    pattern: /void\s+(Update|FixedUpdate)\s*\([^)]*\)\s*\{[^}]*\+\s*"/,
    level: "warn",
    message: "String concatenation in Update loop causes GC allocations. Use StringBuilder or cache strings.",
  },

  // ============================================
  // SUGGESTIONS / INFO
  // ============================================
  
  {
    id: "UNT020",
    pattern: /SendMessage\s*\(\s*"/,
    level: "info",
    message: "SendMessage uses reflection and is slow. Consider direct method calls or UnityEvents.",
  },
  
  {
    id: "UNT021",
    pattern: /GameObject\.Find\s*\(/,
    level: "info",
    message: "GameObject.Find is slow. Consider using [SerializeField] or caching the reference.",
  },
  
  {
    id: "UNT022",
    pattern: /public\s+(int|float|string|bool|GameObject|Transform|Vector[23])\s+\w+\s*[;=](?!\s*\/\/)/,
    level: "info",
    message: "Consider [SerializeField] private instead of public field for better encapsulation.",
    // Don't flag if it's part of an interface or has attributes
    condition: (ctx) => !ctx.content.includes("[") || !ctx.content.includes("]"),
  },
  
  {
    id: "UNT023",
    pattern: /FindObjectOfType\s*</,
    level: "info",
    message: "FindObjectOfType is slow. Consider dependency injection or singleton pattern.",
  },
]

/**
 * Patterns for file-level blocking (checked on file path, not content)
 */
export const FILE_PATTERNS = {
  metaFile: /\.meta$/,
}

/**
 * Get the emoji for a severity level
 */
export function getLevelEmoji(level: string): string {
  switch (level) {
    case "error":
      return "❌"
    case "warn":
      return "⚠️"
    case "info":
      return "💡"
    default:
      return "📝"
  }
}

/**
 * Get the label for a severity level
 */
export function getLevelLabel(level: string): string {
  switch (level) {
    case "error":
      return "ERROR"
    case "warn":
      return "WARNING"
    case "info":
      return "INFO"
    default:
      return "NOTE"
  }
}
