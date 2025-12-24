---
globs: ["Assets/**/*.cs"]
match:
  content: "(Rigidbody|Physics\\.|Collision|Trigger|raycast)"
description: "Unity physics and spatial code guidelines"
---

# Unity Physics Rules

## Rigidbody Operations

### Correct Update Loop
```csharp
// ✅ Physics in FixedUpdate
private void FixedUpdate()
{
    rb.AddForce(Vector3.forward * force);
    rb.velocity = newVelocity;
}

// ❌ Never in Update
private void Update()
{
    rb.AddForce(Vector3.forward * force); // Wrong!
}
```

### Movement Methods
- `Rigidbody.AddForce()` - Apply physics force
- `Rigidbody.MovePosition()` - Kinematic movement with interpolation
- `Rigidbody.velocity` - Direct velocity control (use sparingly)

## Raycasting

### Always Use LayerMask
```csharp
[SerializeField] private LayerMask groundLayer;

// ✅ Efficient - only checks specified layers
Physics.Raycast(origin, direction, out hit, distance, groundLayer);

// ❌ Slow - checks all layers
Physics.Raycast(origin, direction, out hit, distance);
```

### Cache RaycastHit
```csharp
// ✅ Reuse hit struct
private RaycastHit _hit;
if (Physics.Raycast(ray, out _hit, distance, layerMask))
```

## Collision Detection

### Method Selection
- `OnCollisionEnter/Stay/Exit` - Physical collision response
- `OnTriggerEnter/Stay/Exit` - Overlap detection (set IsTrigger = true)

### Layer Matrix
Configure collision matrix in Edit > Project Settings > Physics

## Transform vs Rigidbody

### Rules
1. Never mix `transform.position` with `Rigidbody.velocity` on same object
2. For kinematic bodies, use `MovePosition()` not `transform.position`
3. Physics bodies should only be moved in `FixedUpdate()`

## 3D Math

### Normalization
```csharp
// ✅ Always normalize direction vectors
Vector3 direction = (target - origin).normalized;

// ❌ Risk of incorrect behavior
Vector3 direction = target - origin;
```

### Float Comparison
```csharp
// ✅ Safe comparison
if (Mathf.Approximately(a, b))

// ❌ Unsafe - floating point errors
if (a == b)
```

### Quaternion Usage
```csharp
// ✅ Avoid gimbal lock
transform.rotation = Quaternion.Slerp(current, target, t);

// ❌ Gimbal lock risk
transform.eulerAngles += new Vector3(x, y, z);
```
