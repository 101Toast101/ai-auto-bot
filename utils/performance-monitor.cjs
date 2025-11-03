// utils/performance-monitor.cjs - Performance tracking and monitoring
const { logInfo, logWarn } = require('./logger.cjs');

class PerformanceMonitor {
  constructor() {
    this.startupTime = null;
    this.metrics = {
      startupDuration: null,
      memoryUsage: [],
      operations: new Map()
    };
    
    // Start monitoring
    this.markStartup();
    
    // Monitor memory every 5 minutes
    setInterval(() => {
      this.recordMemoryUsage();
    }, 5 * 60 * 1000);
  }

  markStartup() {
    this.startupTime = Date.now();
  }

  recordStartupComplete() {
    if (this.startupTime) {
      const duration = Date.now() - this.startupTime;
      this.metrics.startupDuration = duration;
      logInfo(`App startup completed in ${duration}ms`);
      
      // Warn if startup is slow
      if (duration > 5000) {
        logWarn(`Slow startup detected: ${duration}ms (target: < 5000ms)`);
      }
    }
  }

  recordMemoryUsage() {
    const usage = process.memoryUsage();
    const memoryMB = {
      rss: Math.round(usage.rss / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      timestamp: Date.now()
    };

    this.metrics.memoryUsage.push(memoryMB);
    
    // Keep only last 24 hours of memory snapshots (288 samples at 5 min intervals)
    if (this.metrics.memoryUsage.length > 288) {
      this.metrics.memoryUsage.shift();
    }

    // Warn if memory usage is high
    if (memoryMB.heapUsed > 200) {
      logWarn(`High memory usage: ${memoryMB.heapUsed}MB heap used (target: < 200MB)`);
    }

    return memoryMB;
  }

  startOperation(name) {
    const id = `${name}_${Date.now()}`;
    this.metrics.operations.set(id, {
      name,
      startTime: Date.now()
    });
    return id;
  }

  endOperation(id) {
    const operation = this.metrics.operations.get(id);
    if (!operation) return null;

    const duration = Date.now() - operation.startTime;
    this.metrics.operations.delete(id);

    // Log slow operations
    if (duration > 1000) {
      logWarn(`Slow operation detected: ${operation.name} took ${duration}ms`);
    }

    return duration;
  }

  getMetrics() {
    const currentMemory = this.recordMemoryUsage();
    
    return {
      startup: {
        duration: this.metrics.startupDuration,
        timestamp: this.startupTime
      },
      memory: {
        current: currentMemory,
        history: this.metrics.memoryUsage.slice(-10), // Last 10 samples
        average: this.calculateAverageMemory()
      },
      performance: {
        activeOperations: this.metrics.operations.size
      }
    };
  }

  calculateAverageMemory() {
    if (this.metrics.memoryUsage.length === 0) return null;

    const sum = this.metrics.memoryUsage.reduce((acc, m) => ({
      rss: acc.rss + m.rss,
      heapUsed: acc.heapUsed + m.heapUsed
    }), { rss: 0, heapUsed: 0 });

    const count = this.metrics.memoryUsage.length;
    return {
      rss: Math.round(sum.rss / count),
      heapUsed: Math.round(sum.heapUsed / count)
    };
  }

  logMetricsSummary() {
    const metrics = this.getMetrics();
    logInfo(`Performance Metrics:
      Startup: ${metrics.startup.duration}ms
      Memory (Current): ${metrics.memory.current.heapUsed}MB / ${metrics.memory.current.rss}MB RSS
      Memory (Average): ${metrics.memory.average?.heapUsed}MB / ${metrics.memory.average?.rss}MB RSS
      Active Operations: ${metrics.performance.activeOperations}`);
  }
}

module.exports = PerformanceMonitor;
