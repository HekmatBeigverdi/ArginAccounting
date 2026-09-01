const TOOLTIP_CLASS = "product-help-popover";
const BUTTON_SELECTOR = ".product-help";
const VIEWPORT_MARGIN = 12;
const GAP = 8;

let activeButton: HTMLButtonElement | null = null;
let activeTooltip: HTMLDivElement | null = null;
let initialized = false;

function closeTooltip(): void {
  if (activeButton) {
    activeButton.setAttribute("aria-expanded", "false");
    activeButton.removeAttribute("aria-describedby");
  }
  activeTooltip?.remove();
  activeButton = null;
  activeTooltip = null;
}

function positionTooltip(button: HTMLButtonElement, tooltip: HTMLDivElement): void {
  const anchor = button.getBoundingClientRect();
  const tip = tooltip.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = anchor.left + anchor.width / 2 - tip.width / 2;
  left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(left, viewportWidth - tip.width - VIEWPORT_MARGIN),
  );

  const above = anchor.top - tip.height - GAP;
  const below = anchor.bottom + GAP;
  let top: number;
  let placement: "top" | "bottom";

  if (above >= VIEWPORT_MARGIN) {
    top = above;
    placement = "top";
  } else if (below + tip.height <= viewportHeight - VIEWPORT_MARGIN) {
    top = below;
    placement = "bottom";
  } else {
    const spaceAbove = Math.max(0, anchor.top - VIEWPORT_MARGIN);
    const spaceBelow = Math.max(0, viewportHeight - anchor.bottom - VIEWPORT_MARGIN);
    placement = spaceBelow >= spaceAbove ? "bottom" : "top";
    top = placement === "bottom"
      ? Math.min(below, viewportHeight - tip.height - VIEWPORT_MARGIN)
      : Math.max(VIEWPORT_MARGIN, above);
  }

  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(Math.max(VIEWPORT_MARGIN, top))}px`;
  tooltip.dataset.placement = placement;
}

function openTooltip(button: HTMLButtonElement): void {
  const help = button.dataset.help?.trim();
  if (!help) return;

  closeTooltip();

  const tooltip = document.createElement("div");
  tooltip.className = TOOLTIP_CLASS;
  tooltip.id = `product-help-${crypto.randomUUID()}`;
  tooltip.setAttribute("role", "tooltip");
  tooltip.textContent = help;
  document.body.appendChild(tooltip);

  activeButton = button;
  activeTooltip = tooltip;
  button.setAttribute("aria-expanded", "true");
  button.setAttribute("aria-describedby", tooltip.id);

  positionTooltip(button, tooltip);
}

function handleDocumentClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const button = target.closest<HTMLButtonElement>(BUTTON_SELECTOR);
  if (button) {
    event.preventDefault();
    if (button === activeButton) {
      closeTooltip();
    } else {
      openTooltip(button);
    }
    return;
  }

  if (!target.closest(`.${TOOLTIP_CLASS}`)) {
    closeTooltip();
  }
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape") closeTooltip();
}

function reposition(): void {
  if (activeButton && activeTooltip) {
    positionTooltip(activeButton, activeTooltip);
  }
}

export function initializeProductHelpController(): void {
  if (initialized || typeof document === "undefined") return;
  initialized = true;

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleKeyDown);
  window.addEventListener("resize", reposition);
  window.addEventListener("scroll", reposition, true);
}

initializeProductHelpController();
