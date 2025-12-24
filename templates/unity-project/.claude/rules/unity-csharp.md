---
globs: ["Assets/**/*.cs"]
description: "Unity C# coding standards and best practices"
---

# Unity C# Rules

## MonoBehaviour Lifecycle

### Initialization
- `Awake()`: Initialize SELF (GetComponent on this object)
- `Start()`: Initialize RELATIONSHIPS (Find other objects, connect to managers)
- `OnEnable()`: Subscribe to events
- `OnDisable()`: Unsubscribe from events (ALWAYS pair with OnEnable)

### Update Methods
- `FixedUpdate()`: Physics ONLY (Rigidbody forces, velocity)
- `Update()`: Per-frame logic, input handling
- `LateUpdate()`: Camera follow, post-animation adjustments

## Performance Requirements

### Caching
- Cache ALL `GetComponent<T>()` calls in `Awake()` or `Start()`
- Cache `Camera.main` (it calls FindGameObjectsWithTag internally)
- Cache `transform` reference for frequent access

### Avoid in Update Loops
- `GetComponent<T>()`
- `GameObject.Find()`
- `FindObjectOfType<T>()`
- `Resources.Load()`
- String concatenation with `+`

### Comparisons
- Use `CompareTag("Tag")` instead of `tag == "Tag"`
- Use `Mathf.Approximately()` for float comparisons

## Code Style

### Field Serialization
```csharp
// ✅ Preferred
[SerializeField] private float speed = 5f;

// ❌ Avoid (exposes implementation)
public float speed = 5f;
```

### Component Requirements
```csharp
[RequireComponent(typeof(Rigidbody))]
public class PlayerController : MonoBehaviour
```

### Inspector Organization
```csharp
[Header("Movement")]
[SerializeField] private float moveSpeed = 5f;
[SerializeField] private float jumpForce = 10f;

[Space(10)]
[Header("References")]
[SerializeField] private Transform groundCheck;
```

## Editor Code

Always wrap UnityEditor usage:
```csharp
#if UNITY_EDITOR
using UnityEditor;
// Editor-only code here
#endif
```

## Async Patterns

```csharp
// ❌ Avoid - exceptions are swallowed
async void DoSomething() { }

// ✅ Use UniTask or return Task
async UniTask DoSomething() { }
async Task DoSomething() { }

// ✅ Exception: Unity lifecycle methods
async void Start() { await LoadAsync(); }
```
