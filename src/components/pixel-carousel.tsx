import * as React from "react";

interface SpriteBounds {
    index: number;
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface CarouselPage {
    title: string;
    url: string;
}

interface PixelCarouselProps {
    /** Number of sprite images to load. Cannot exceed the number of pages. */
    count?: number;
    /** Image filename prefix. For example, "/dimsum" loads /dimsum000.png. */
    imagePrefix?: string;
    /** Pages shown by the carousel. Each page corresponds to one sprite image. */
    pages?: CarouselPage[];
    className?: string;
}

const DEFAULT_PAGES: CarouselPage[] = [
    {
        title: "Writings",
        url: "/writings/",
    },
    {
        title: "Projects",
        url: "/projects/",
    },
    {
        title: "About Me",
        url: "/about/",
    },
    {
        title: "Book List",
        url: "/contact/",
    },
];

const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 200;

// Carousel appearance
const RADIUS_X = 105;
const RADIUS_Y = 38;
const CENTER_Y = 120;
const CENTER_SCALE = 0.25;
const SIDE_SCALE = 0.1;
const DRAG_SENSITIVITY = 0.006;
const ANIMATION_DURATION = 350;

const wrapIndex = (index: number, length: number): number =>
    length > 0 ? ((index % length) + length) % length : 0;

export default function PixelCarousel({
    count,
    imagePrefix = "./dimsums",
    pages = DEFAULT_PAGES,
    className,
}: PixelCarouselProps) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [centerIndex, setCenterIndex] = React.useState(0);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");

        if (!canvas || !ctx || pages.length === 0) {
            return;
        }

        const imageCount = Math.max(
            1,
            Math.min(count ?? pages.length, pages.length)
        );

        const images: HTMLImageElement[] = [];
        let currentCenterIndex = 0;
        let dragOffset = 0;
        let dragging = false;
        let startX = 0;
        let animating = false;
        let spriteBounds: SpriteBounds[] = [];
        let pointerStartX = 0;
        let pointerStartY = 0;
        let didDrag = false;
        let animationFrame = 0;

        const angleStep = (2 * Math.PI) / imageCount;

        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        canvas.tabIndex = 0;
        canvas.setAttribute(
            "aria-label",
            "Pixel carousel. Use the arrow keys to browse pages."
        );

        ctx.imageSmoothingEnabled = false;

        const drawTable = (rotation: number) => {
            ctx.save();

            // Table dimensions
            const centerX = canvas.width / 2;
            const centerY = CENTER_Y - 20;
            const radiusX = RADIUS_X + 40;
            const radiusY = RADIUS_Y + 20;

            // Table shadow
            ctx.fillStyle = "#bd8269";
            ctx.beginPath();
            ctx.ellipse(
                centerX,
                centerY + 8,
                radiusX,
                radiusY,
                0,
                0,
                Math.PI * 2
            );
            ctx.fill();

            // Table surface
            ctx.fillStyle = "#dbb57a";
            ctx.beginPath();
            ctx.ellipse(
                centerX,
                centerY,
                radiusX,
                radiusY,
                0,
                0,
                Math.PI * 2
            );
            ctx.fill();

            // Table outline
            ctx.strokeStyle = "#5e4f5d";
            ctx.lineWidth = 2;
            ctx.stroke();

            // Clip markings to the tabletop
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
            ctx.clip();

            // Rotating radial markings
            ctx.strokeStyle = "#bd8269";
            ctx.lineWidth = 1;

            const segments = 16;

            for (let i = 0; i < segments; i++) {
                const angle = (i / segments) * Math.PI * 2 + rotation;

                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(
                    centerX + Math.sin(angle) * radiusX,
                    centerY + Math.cos(angle) * radiusY
                );
                ctx.stroke();
            }

            ctx.restore();
        };
        const drawSprite = (index: number, angle: number) => {
            const wrappedIndex = wrapIndex(index, images.length);
            const image = images[wrappedIndex];

            if (!image || !image.complete || image.naturalWidth === 0) {
                return;
            }

            const x = canvas.width / 2 + RADIUS_X * Math.sin(angle);
            const y = CENTER_Y - RADIUS_Y * (1 - Math.cos(angle));
            const depth = (Math.cos(angle) + 1) / 2;
            const scale = SIDE_SCALE + (CENTER_SCALE - SIDE_SCALE) * depth;

            const width = image.width * scale;
            const height = image.height * scale;
            const left = x - width / 2;
            const top = y - height / 2;

            // Darker toward the back, with no blur.
            const brightness = 65 + depth * 35;

            // Draw sprite.
            ctx.save();
            ctx.filter = `brightness(${brightness}%)`;
            ctx.drawImage(image, left, top, width, height);
            ctx.restore();

            // Draw title independently so it doesn't shrink with the sprite.
            const page = pages[wrappedIndex];

            if (page) {
                ctx.save();
                ctx.filter = "none";
                ctx.font = "bold 12px Merriweather";
                ctx.textAlign = "center";
                ctx.textBaseline = "bottom";
                ctx.fillStyle = `rgba(94, 79, 93, ${0.65 + depth * 0.35})`;
                ctx.fillText(page.title, x, top);
                ctx.restore();
            }

            // Store hitboxes in drawing order for click detection.
            spriteBounds.push({
                index: wrappedIndex,
                x: left,
                y: top,
                w: width,
                h: height,
            });
        };

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const rotation =
                -currentCenterIndex * angleStep + dragOffset;
            drawTable(rotation);

            spriteBounds = [];

            // Draw surrounding images first, behind the center.
            const half = Math.floor(images.length / 2);

            for (let offset = -half; offset <= half; offset++) {
                if (offset === 0) continue;

                // For an even count, avoid drawing the opposite image twice.
                if (images.length % 2 === 0 && offset === half) {
                    continue;
                }

                const angle = offset * angleStep + dragOffset;
                drawSprite(currentCenterIndex + offset, angle);
            }

            // Draw the center image last, on top.
            drawSprite(currentCenterIndex, dragOffset);
        };

        const animateTo = (
            targetOffset: number,
            direction = 0,
            onComplete: (() => void) | null = null
        ) => {
            if (animating) return;

            animating = true;

            const startOffset = dragOffset;
            const startTime = performance.now();

            const step = (now: number) => {
                const progress = Math.min(
                    (now - startTime) / ANIMATION_DURATION,
                    1
                );

                // Smooth ease-in/ease-out.
                const eased = progress * progress * (3 - 2 * progress);
                dragOffset =
                    startOffset + (targetOffset - startOffset) * eased;

                draw();

                if (progress < 1) {
                    animationFrame = requestAnimationFrame(step);
                } else {
                    if (direction !== 0) {
                        currentCenterIndex = wrapIndex(
                            currentCenterIndex + direction,
                            images.length
                        );
                        setCenterIndex(currentCenterIndex);
                    }

                    dragOffset = 0;
                    animating = false;
                    draw();

                    onComplete?.();
                }
            };

            animationFrame = requestAnimationFrame(step);
        };

        const moveCarousel = (direction: number) => {
            if (animating || dragging) return;
            animateTo(-direction * angleStep, direction);
        };

        // Rotate to any clicked image, taking the shortest path.
        const rotateToImage = (targetIndex: number) => {
            if (animating || dragging) return;

            targetIndex = wrapIndex(targetIndex, images.length);

            const forward = wrapIndex(
                targetIndex - currentCenterIndex,
                images.length
            );
            const backward = forward - images.length;
            const steps =
                Math.abs(forward) <= Math.abs(backward) ? forward : backward;

            if (steps === 0) return;

            const direction = Math.sign(steps);
            let remaining = Math.abs(steps);

            const nextStep = () => {
                if (remaining <= 0) return;

                remaining--;

                animateTo(-direction * angleStep, direction, nextStep);
            };

            nextStep();
        };

        // Pointer dragging
        const onPointerDown = (event: PointerEvent) => {
            if (animating) return;

            dragging = true;
            didDrag = false;

            startX = event.clientX;
            pointerStartX = event.clientX;
            pointerStartY = event.clientY;

            canvas.setPointerCapture(event.pointerId);
        };

        const onPointerMove = (event: PointerEvent) => {
            if (!dragging) return;

            const delta = event.clientX - startX;

            if (
                Math.abs(event.clientX - pointerStartX) > 4 ||
                Math.abs(event.clientY - pointerStartY) > 4
            ) {
                didDrag = true;
            }

            dragOffset = delta * DRAG_SENSITIVITY;
            draw();
        };

        const finishDrag = () => {
            if (!dragging) return;

            dragging = false;

            if (dragOffset < -angleStep / 2) {
                animateTo(-angleStep, 1);
            } else if (dragOffset > angleStep / 2) {
                animateTo(angleStep, -1);
            } else {
                animateTo(0);
            }
        };

        // Ignore clicks that were actually drags.
        const onClick = (event: MouseEvent) => {
            if (didDrag || animating) {
                didDrag = false;
                return;
            }

            const rect = canvas.getBoundingClientRect();
            const mouseX =
                ((event.clientX - rect.left) * canvas.width) / rect.width;
            const mouseY =
                ((event.clientY - rect.top) * canvas.height) / rect.height;

            // Search from front to back, matching visual stacking.
            for (let i = spriteBounds.length - 1; i >= 0; i--) {
                const sprite = spriteBounds[i];

                if (!sprite) continue;

                if (
                    mouseX >= sprite.x &&
                    mouseX <= sprite.x + sprite.w &&
                    mouseY >= sprite.y &&
                    mouseY <= sprite.y + sprite.h
                ) {
                    rotateToImage(sprite.index);
                    return;
                }
            }
        };

        // Keyboard navigation
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "ArrowRight") {
                event.preventDefault();
                moveCarousel(1);
            } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                moveCarousel(-1);
            } else if (event.key === "Enter") {
                event.preventDefault();
                const page = pages[currentCenterIndex];
                if (page) window.location.href = page.url;
            }
        };

        const onPreviousClick = () => moveCarousel(-1);
        const onNextClick = () => moveCarousel(1);
        const onSelectClick = () => {
            const page = pages[currentCenterIndex];
            if (page) window.location.href = page.url;
        };

        // Load the sprite images.
        for (let i = 0; i < imageCount; i++) {
            const image = new Image();
            image.onload = draw;
            image.src = `${imagePrefix}${String(i).padStart(3, "0")}.png`;
            images.push(image);
        }

        canvas.addEventListener("pointerdown", onPointerDown);
        canvas.addEventListener("pointermove", onPointerMove);
        canvas.addEventListener("pointerup", finishDrag);
        canvas.addEventListener("pointercancel", finishDrag);
        canvas.addEventListener("click", onClick);
        window.addEventListener("keydown", onKeyDown);
        const onCarouselPrevious = () => moveCarousel(-1);
        const onCarouselNext = () => moveCarousel(1);
        canvas.addEventListener("carousel-previous", onCarouselPrevious);
        canvas.addEventListener("carousel-next", onCarouselNext);

        draw();

        return () => {
            cancelAnimationFrame(animationFrame);

            canvas.removeEventListener("pointerdown", onPointerDown);
            canvas.removeEventListener("pointermove", onPointerMove);
            canvas.removeEventListener("pointerup", finishDrag);
            canvas.removeEventListener("pointercancel", finishDrag);
            canvas.removeEventListener("click", onClick);
            window.removeEventListener("keydown", onKeyDown);
            canvas.removeEventListener("carousel-previous", onCarouselPrevious);
            canvas.removeEventListener("carousel-next", onCarouselNext);

            images.forEach((image) => {
                image.onload = null;
            });
        };
    }, [count, imagePrefix, pages]);

    const currentPage = pages[centerIndex] ?? pages[0];

    if (!currentPage) {
        return null;
    }

    const goToPage = () => {
        window.location.href = currentPage.url;
    };

    return (
        <section className={className ? `pixel-carousel ${className}` : "pixel-carousel"}>
            <canvas ref={canvasRef} />

            <div className="carousel-controls">
                <div className="carousel-navigation">
                    <button
                        type="button"
                        className="previous"
                        aria-label="Previous page"
                        onClick={() => {
                            // The canvas keyboard and pointer handlers share the carousel engine.
                            canvasRef.current?.dispatchEvent(
                                new Event("carousel-previous")
                            );
                        }}
                    >
                        ←
                    </button>
                    <button
                        type="button"
                        className="select-page"
                        onClick={goToPage}
                        aria-label={`Open ${currentPage.title}`}
                    >
                        Select
                    </button>
                    <button
                        type="button"
                        className="next"
                        aria-label="Next page"
                        onClick={() => {
                            canvasRef.current?.dispatchEvent(
                                new Event("carousel-next")
                            );
                        }}
                    >
                        →
                    </button>
                </div>

                <p className="carousel-hint">
                    Drag or ← / → to browse
                </p>
            </div>
        </section>
    );
}
