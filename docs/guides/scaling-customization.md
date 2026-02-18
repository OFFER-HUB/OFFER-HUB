# Scaling & Customization

This guide explains how to run multiple Orchestrator instances in production and which configuration each instance should have.

## Horizontal Scaling

The Orchestrator is stateless for HTTP requests (all state lives in Postgres and Redis). You can run multiple API instances behind a load balancer. However, the **BlockchainMonitorService** must run on **exactly one instance** at a time.

### Why Only One Monitor Instance?

`BlockchainMonitorService` opens a persistent Horizon SSE stream per wallet. If two instances both monitor the same wallet:

- Each instance emits its own `balance.credited` event for the same deposit.
- Even with in-memory deduplication (`processedTxHashes`), the set is per-process — a tx hash seen by instance A is not known to instance B.
- This causes double-crediting user balances.

### Recommended Setup

| Instance Role | `DISABLE_BLOCKCHAIN_MONITOR` | Description |
|---|---|---|
| **Monitor instance** (1 only) | not set / `false` | Runs the Horizon SSE streams |
| **API instances** (N) | `true` | Handle HTTP requests only |

```bash
# Monitor instance (Railway / Kubernetes dedicated pod)
DISABLE_BLOCKCHAIN_MONITOR=false  # or just don't set it

# All other API instances
DISABLE_BLOCKCHAIN_MONITOR=true
```

When the monitor is disabled, startup logs will show:

```
[BlockchainMonitor] Monitoring DISABLED via env var
```

## Graceful Shutdown

The Orchestrator registers `SIGTERM` and `SIGINT` handlers on startup. When the process receives a signal (e.g., from Kubernetes during a rolling deploy or Railway restart):

1. **HTTP server stops** accepting new requests.
2. **In-flight requests** are given time to complete (NestJS `app.close()`).
3. **BullMQ workers** finish their current job before stopping.
4. **Horizon SSE streams** are closed via `BlockchainMonitorService.onModuleDestroy()`.
5. Process exits cleanly with code `0`.

If shutdown takes longer than **30 seconds**, the process force-exits with code `1` to prevent indefinite hangs.

Startup confirms registration with:

```
[Shutdown] Graceful shutdown handler registered
```

### Kubernetes Example

```yaml
spec:
  terminationGracePeriodSeconds: 35  # > 30s app timeout
  containers:
    - name: orchestrator-api
      lifecycle:
        preStop:
          exec:
            command: ["/bin/sh", "-c", "sleep 2"]  # Allow LB to drain
```

## Redis / BullMQ

All instances share the same Redis instance. BullMQ workers process jobs from shared queues — this is safe for horizontal scaling because BullMQ uses atomic job locking. No additional configuration is needed.

## Database Connections

Use **PgBouncer** (pooler URL port 6543) for HTTP instances to avoid exhausting Postgres connection limits. The monitor instance can also use the pooler — it only makes periodic `findMany` calls on startup.

For Prisma migrations, always use the direct URL (port 5432):

```bash
DIRECT_URL=postgres://USER:PASSWORD@HOST:5432/postgres
```
