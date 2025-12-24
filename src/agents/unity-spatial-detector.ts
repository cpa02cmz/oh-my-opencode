/**
 * Unity Spatial Task Detector
 * 
 * Detects whether a prompt/task requires spatial understanding
 * and should be delegated to the unity-spatial-engineer agent.
 */

// Keywords that indicate spatial/physics work
const SPATIAL_KEYWORDS = [
  // 3D Math
  "vector3",
  "vector2",
  "quaternion",
  "euler",
  "matrix",
  "transform",
  "rotate",
  "rotation",
  "position",
  "direction",
  "normalize",
  "magnitude",
  "dot product",
  "cross product",
  "lerp",
  "slerp",
  "angle",
  "distance",
  "clamp",
  "smoothdamp",

  // Physics
  "rigidbody",
  "physics",
  "raycast",
  "spherecast",
  "boxcast",
  "linecast",
  "collision",
  "collider",
  "trigger",
  "force",
  "velocity",
  "gravity",
  "mass",
  "drag",
  "joint",
  "constraint",
  "overlap",
  "kinematic",

  // Camera
  "camera",
  "viewport",
  "frustum",
  "fov",
  "field of view",
  "lookat",
  "look at",
  "follow camera",
  "orbit camera",
  "fps camera",
  "third person camera",
  "screen to world",
  "world to screen",
  "cinemachine",

  // Navigation
  "navmesh",
  "nav mesh",
  "pathfinding",
  "path finding",
  "navigation",
  "waypoint",
  "steering",
  "obstacle",
  "avoidance",
  "a star",
  "a*",
  "navmeshagent",

  // Animation Spatial
  "ik",
  "inverse kinematic",
  "root motion",
  "ragdoll",
  "physics animation",

  // Shader/Visual Spatial
  "shader math",
  "uv",
  "vertex",
  "world space",
  "object space",
  "local space",
  "normal",
  "tangent",
  "displacement",
  "triplanar",

  // Movement Patterns
  "projectile",
  "trajectory",
  "homing",
  "prediction",
  "interpolation",
  "bezier",
  "spline",
  "curve",
] as const

// Regex patterns for more specific detection
const SPATIAL_PATTERNS: RegExp[] = [
  // Transform operations
  /transform\.(position|rotation|forward|right|up|localPosition|localRotation)/i,
  
  // Vector operations
  /vector[23]\.(normalize|magnitude|distance|angle|dot|cross|lerp|slerp)/i,
  
  // Quaternion operations
  /quaternion\.(euler|lookrotation|slerp|lerp|angle|inverse)/i,
  
  // Physics operations
  /physics\.(raycast|spherecast|boxcast|linecast|overlap|checksphere)/i,
  
  // Camera operations
  /camera\.(main|screento|worldto|viewportto)/i,
  
  // Rigidbody operations
  /rigidbody\.(addforce|velocity|angularvelocity|moveposition|moverotation)/i,
  
  // NavMesh operations
  /navmesh\.(sampleposition|calculatepath|raycast)/i,
  /navmeshagent\.(setdestination|remainingdistance|velocity)/i,
  
  // Common spatial method calls
  /\.(lookat|rotatearound|transformpoint|inversetransformpoint)/i,
  
  // Spatial calculations
  /mathf\.(lerp|inverselerp|smoothdamp|clamp|approximately|angle)/i,
]

/**
 * Determines if a task/prompt requires spatial understanding.
 * 
 * @param prompt - The user's prompt or task description
 * @returns true if the task should be delegated to unity-spatial-engineer
 */
export function isSpatialTask(prompt: string): boolean {
  const lowerPrompt = prompt.toLowerCase()

  // Check keywords
  const hasKeyword = SPATIAL_KEYWORDS.some((keyword) =>
    lowerPrompt.includes(keyword.toLowerCase())
  )

  if (hasKeyword) {
    return true
  }

  // Check patterns
  const hasPattern = SPATIAL_PATTERNS.some((pattern) => pattern.test(prompt))

  return hasPattern
}

/**
 * Returns a list of detected spatial concepts in the prompt.
 * Useful for debugging or providing context.
 * 
 * @param prompt - The user's prompt or task description
 * @returns Array of detected spatial concepts
 */
export function detectSpatialConcepts(prompt: string): string[] {
  const lowerPrompt = prompt.toLowerCase()
  const detected: string[] = []

  // Find matching keywords
  for (const keyword of SPATIAL_KEYWORDS) {
    if (lowerPrompt.includes(keyword.toLowerCase())) {
      detected.push(keyword)
    }
  }

  // Find matching patterns
  for (const pattern of SPATIAL_PATTERNS) {
    const match = prompt.match(pattern)
    if (match) {
      detected.push(match[0])
    }
  }

  // Remove duplicates
  return [...new Set(detected)]
}

/**
 * Categories of spatial tasks for more granular routing.
 */
export type SpatialCategory =
  | "physics"
  | "camera"
  | "navigation"
  | "animation"
  | "math"
  | "shader"
  | "none"

/**
 * Categorizes the spatial task for potential sub-routing.
 * 
 * @param prompt - The user's prompt or task description
 * @returns The primary spatial category
 */
export function categorizeSpatialTask(prompt: string): SpatialCategory {
  const lowerPrompt = prompt.toLowerCase()

  const categories: { category: SpatialCategory; keywords: string[] }[] = [
    {
      category: "physics",
      keywords: [
        "rigidbody",
        "physics",
        "raycast",
        "collision",
        "trigger",
        "force",
        "velocity",
        "joint",
      ],
    },
    {
      category: "camera",
      keywords: [
        "camera",
        "viewport",
        "cinemachine",
        "follow",
        "orbit",
        "fps camera",
        "look at",
      ],
    },
    {
      category: "navigation",
      keywords: [
        "navmesh",
        "pathfinding",
        "navigation",
        "waypoint",
        "steering",
        "a*",
      ],
    },
    {
      category: "animation",
      keywords: ["ik", "inverse kinematic", "root motion", "ragdoll", "blend"],
    },
    {
      category: "shader",
      keywords: ["shader", "uv", "vertex", "normal", "tangent", "triplanar"],
    },
    {
      category: "math",
      keywords: [
        "vector",
        "quaternion",
        "matrix",
        "lerp",
        "slerp",
        "interpolation",
      ],
    },
  ]

  for (const { category, keywords } of categories) {
    if (keywords.some((kw) => lowerPrompt.includes(kw))) {
      return category
    }
  }

  return "none"
}
