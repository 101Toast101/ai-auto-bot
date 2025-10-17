// VirtualScroller.js - Optimized content display
class VirtualScroller {
  constructor(container, items, options = {}) {
    this.container = container;
    this.items = items;
    this.options = {
      itemHeight: options.itemHeight || 200,
      pageSize: options.pageSize || 20,
      threshold: options.threshold || 500,
      ...options
    };

    this.visibleItems = new Set();
    this.observer = null;
    this.scrollHandler = this.handleScroll.bind(this);
    this.resizeObserver = null;

    this.init();
  }

  init() {
    // Set up container styles
    this.container.style.position = 'relative';
    this.container.style.overflow = 'auto';

    // Create intersection observer for lazy loading
    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersection(entries),
      {
        root: this.container,
        rootMargin: `${this.options.threshold}px 0px`,
        threshold: 0
      }
    );

    // Set up resize observer
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    // Initial render
    this.render();

    // Add scroll listener
    this.container.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  handleScroll() {
    requestAnimationFrame(() => this.updateVisibleItems());
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      const itemId = entry.target.dataset.itemId;
      if (entry.isIntersecting) {
        this.visibleItems.add(itemId);
      } else {
        this.visibleItems.delete(itemId);
      }
    });
  }

  handleResize() {
    // Recalculate layout
    this.render();
  }

  updateVisibleItems() {
    const scrollTop = this.container.scrollTop;
    const containerHeight = this.container.clientHeight;

    const startIndex = Math.floor(scrollTop / this.options.itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / this.options.itemHeight) + 1,
      this.items.length
    );

    // Update visible range
    for (let i = 0; i < this.items.length; i++) {
      const itemElement = this.container.children[i];
      if (i >= startIndex && i <= endIndex) {
        itemElement.style.display = '';
        this.observer.observe(itemElement);
      } else {
        itemElement.style.display = 'none';
        this.observer.unobserve(itemElement);
      }
    }
  }

  render() {
    // Clear container
    this.container.innerHTML = '';

    // Calculate total height
    const totalHeight = this.items.length * this.options.itemHeight;

    // Create and append items
    this.items.forEach((item, index) => {
      const itemElement = document.createElement('div');
      itemElement.className = 'virtual-item';
      itemElement.dataset.itemId = item.id || index;
      itemElement.style.position = 'absolute';
      itemElement.style.top = `${index * this.options.itemHeight}px`;
      itemElement.style.height = `${this.options.itemHeight}px`;
      itemElement.style.width = '100%';

      // Add content
      itemElement.innerHTML = this.options.renderItem
        ? this.options.renderItem(item)
        : this.defaultRenderItem(item);

      this.container.appendChild(itemElement);
    });

    // Set container height
    this.container.style.height = `${totalHeight}px`;

    // Initial visible items update
    this.updateVisibleItems();
  }

  defaultRenderItem(item) {
    return `
      <div class="virtual-item-content">
        ${item.title || item.content || JSON.stringify(item)}
      </div>
    `;
  }

  destroy() {
    this.container.removeEventListener('scroll', this.scrollHandler);
    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
  }

  // Public API
  refresh() {
    this.render();
  }

  setItems(newItems) {
    this.items = newItems;
    this.refresh();
  }

  scrollToItem(itemId) {
    const itemElement = this.container.querySelector(`[data-item-id="${itemId}"]`);
    if (itemElement) {
      itemElement.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

module.exports = VirtualScroller;
