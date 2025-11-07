# Node-RED Original PID

```
npm install node-red-contrib-originalpid
```

A simple, **“original”** PID controller node for Node-RED — modeled after the classic Arduino PID implementation.
Unlike other derived versions, this node exposes **Kp**, **Ki**, **Kd**, and **sampleTime** directly, giving you full control and predictable behavior.

---

### Features

* **True PID** — directly uses Kp, Ki, Kd, and sampleTime
* **Derivative on input** to avoid setpoint kick
* **Anti-windup** for stable integral term
* **Noisy input filtering** for filtering of noisy sensors
* **Persistent state** between restarts (using Node-RED context)
* **Manual reset** via `{ "reset": true }` or `{ "restart": true }`
* **Status indicators:**

    * Yellow → state reset / restored
    * Green → normal operation with live output and error
* No dependencies, minimal overhead

---

### Example

Input:

```json
{ "payload": 23.5 }
```

Output:

```json
{ "payload": 0.62 }
```

Reset:

```json
{ "reset": true }
```

When persistent context, called file, is enabled in `settings.js`:

```js
contextStorage: {
    file: { module: "localfilesystem", config: { dir: "/data/context" } },
    default: { module: "memory" }
}
```

the node automatically restores its state (`outputSum`, `lastInput`, `lastTime`) after restart of nodered or after change of parameters, to avoid calculating it from clean slate.

---

### Version history

* **v0.3.1** - Filtering of noisy input capability. Changed the label and status message.
* **v0.2.0** - Changing setpoint by input.
* **v0.1.0** – Initial version published to github.
