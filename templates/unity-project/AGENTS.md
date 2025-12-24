# Unity Project Guidelines

## Agent Routing

| Task Type | Agent | When to Use |
|-----------|-------|-------------|
| **C# Scripting** | `@unity-engineer` | MonoBehaviour, ScriptableObject, events, game logic |
| **Physics/3D** | `@unity-spatial-engineer` | Rigidbody, raycasting, cameras, navigation, 3D math |
| **Documentation** | `@librarian` | Unity API lookup, package research |
| **Code Search** | `@explore` | Find existing patterns in codebase |

## Project Architecture

<!-- Customize these sections for your project -->

### Patterns Used
- **Architecture**: [MVC / MVVM / ECS / Custom]
- **DI Framework**: [None / VContainer / Zenject]
- **Event System**: [UnityEvents / ScriptableObject Events / C# Events]

### Folder Structure
```
Assets/
├── _Project/           # Project-specific code
│   ├── Scripts/
│   │   ├── Runtime/    # Runtime scripts
│   │   └── Editor/     # Editor-only scripts
│   ├── Prefabs/
│   ├── ScriptableObjects/
│   └── Scenes/
├── Plugins/            # Third-party plugins
└── Resources/          # Runtime-loaded assets
```

## Coding Conventions

### Naming
- **Scripts**: PascalCase (`PlayerController.cs`)
- **Prefabs**: PascalCase (`EnemySpawner.prefab`)
- **ScriptableObjects**: PascalCase + SO suffix (`PlayerConfigSO.asset`)
- **Scenes**: PascalCase (`MainMenu.unity`)
- **Private fields**: `_camelCase` with underscore prefix

### MonoBehaviour Rules
1. Cache all `GetComponent<T>()` calls in `Awake()`
2. Use `[SerializeField] private` for Inspector fields
3. Pair `OnEnable()` with `OnDisable()` for subscriptions
4. Delete empty `Update()`/`FixedUpdate()` methods

### Performance Guidelines
- Use object pooling for frequently spawned objects
- Avoid `GameObject.Find()` and `FindObjectOfType()` in loops
- Cache `Camera.main` reference
- Use `CompareTag()` instead of `tag ==`

## Critical Reminders

⚠️ **Never create .meta files manually** - Unity generates these

⚠️ **Never use `new MonoBehaviour()`** - Use `AddComponent<T>()`

⚠️ **Wrap UnityEditor code** - Use `#if UNITY_EDITOR` directives
