import * as React from "react"

/**
 * Defines the useCarousel hook which is the main engine which draws the pixel art
 * for the carousel and handles the
 */

export type CarouselPage = {
    title: string
    url: string
}

export type UseCarouselProps = {
    canvasRef: React.RefObject<HTMLCanvasElement | null>
    pages: CarouselPage[]
    imagePrefix: string
    canvasWidth: number
    canvasHeight: number
    centerY: number
    radiusX: number
    radiusY: number
    sideScale: number
    centerScale: number
    dragSensitivity: number
    animationDuration: number
}

export const useCarousel = ({
    canvasRef,
    pages,
    imagePrefix,
    canvasWidth,
    canvasHeight,
    centerY,
    radiusX,
    radiusY,
    sideScale,
    centerScale,
    dragSensitivity,
    animationDuration,
}: UseCarouselProps) => {
    const [centerIndex, setCenterIndex] = React.useState(0)

    React.useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext("2d")

        if (!canvas || !ctx || pages.length === 0) return

        const expectedCount = pages.length

        let currentCenterIndex = 0
        let dragOffset = 0
        let dragging = false
        let startX = 0
        let dragMultiplier = 1
        let animating = false
        let animationFrame = 0

        const angleStep = (2 * Math.PI) / expectedCount

        canvas.width = canvasWidth
        canvas.height = canvasHeight
        canvas.tabIndex = 0
        canvas.setAttribute(
            "aria-label",
            "Page carousel. Use the arrow keys to browse pages."
        )

        ctx.imageSmoothingEnabled = false

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            const rotation = -currentCenterIndex * angleStep + dragOffset

            drawTabletop(ctx, canvas.width, centerY, radiusX, radiusY, rotation)

            const half = Math.floor(images.length / 2)

            for (let offset = -half; offset <= half; offset++) {
                if (offset === 0) continue
                if (images.length % 2 === 0 && offset === half) continue

                const angle = offset * angleStep + dragOffset
                const spriteIdx = wrapIndex(
                    currentCenterIndex + offset,
                    images.length
                )
                drawSpriteItem(
                    ctx,
                    canvas.width,
                    images[spriteIdx],
                    pages[spriteIdx],
                    angle,
                    centerY,
                    radiusX,
                    radiusY,
                    sideScale,
                    centerScale
                )
            }

            const centerWrapped = wrapIndex(currentCenterIndex, images.length)
            drawSpriteItem(
                ctx,
                canvas.width,
                images[centerWrapped],
                pages[centerWrapped],
                dragOffset,
                centerY,
                radiusX,
                radiusY,
                sideScale,
                centerScale
            )
        }

        const images = preloadCarouselImages(
            imagePrefix,
            expectedCount,
            draw,
            (idx, src) =>
                console.error(
                    `[PixelCarousel] Failed image at index ${idx}: ${src}. Mismatch: expected ${expectedCount} images.`
                )
        )
        console.warn()

        const animateTo = (
            targetOffset: number,
            direction = 0,
            onComplete: (() => void) | null = null
        ) => {
            if (animating) return

            animating = true
            const startOffset = dragOffset
            const startTime = performance.now()

            const step = (now: number) => {
                const progress = Math.min(
                    (now - startTime) / animationDuration,
                    1
                )
                const eased = progress * progress * (3 - 2 * progress)
                dragOffset = startOffset + (targetOffset - startOffset) * eased

                draw()

                if (progress < 1) {
                    animationFrame = requestAnimationFrame(step)
                } else {
                    if (direction !== 0) {
                        currentCenterIndex = wrapIndex(
                            currentCenterIndex + direction,
                            images.length
                        )
                        setCenterIndex(currentCenterIndex)
                    }

                    dragOffset = 0
                    animating = false
                    draw()
                    onComplete?.()
                }
            }

            animationFrame = requestAnimationFrame(step)
        }

        const moveCarousel = (direction: number) => {
            if (animating || dragging) return
            animateTo(-direction * angleStep, direction)
        }

        const onPointerDown = (event: PointerEvent) => {
            if (animating) return

            dragging = true
            startX = event.clientX

            const rect = canvas.getBoundingClientRect()
            const canvasY =
                ((event.clientY - rect.top) * canvas.height) / rect.height
            const tableCenterY = centerY - 20

            dragMultiplier = canvasY < tableCenterY ? -1 : 1
            canvas.setPointerCapture(event.pointerId)
        }

        const onPointerMove = (event: PointerEvent) => {
            if (!dragging) return

            const deltaX = event.clientX - startX
            dragOffset = deltaX * dragSensitivity * dragMultiplier
            draw()
        }

        const finishDrag = () => {
            if (!dragging) return
            dragging = false

            if (dragOffset < -angleStep / 2) {
                animateTo(-angleStep, 1)
            } else if (dragOffset > angleStep / 2) {
                animateTo(angleStep, -1)
            } else {
                animateTo(0)
            }
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "ArrowRight") {
                event.preventDefault()
                moveCarousel(1)
            } else if (event.key === "ArrowLeft") {
                event.preventDefault()
                moveCarousel(-1)
            } else if (event.key === "Enter") {
                event.preventDefault()
                const page = pages[currentCenterIndex]
                if (page) window.location.href = page.url
            }
        }

        const onCarouselPrevious = () => moveCarousel(-1)
        const onCarouselNext = () => moveCarousel(1)

        canvas.addEventListener("pointerdown", onPointerDown)
        canvas.addEventListener("pointermove", onPointerMove)
        canvas.addEventListener("pointerup", finishDrag)
        canvas.addEventListener("pointercancel", finishDrag)
        canvas.addEventListener("carousel-previous", onCarouselPrevious)
        canvas.addEventListener("carousel-next", onCarouselNext)
        window.addEventListener("keydown", onKeyDown)

        draw()

        return () => {
            cancelAnimationFrame(animationFrame)

            canvas.removeEventListener("pointerdown", onPointerDown)
            canvas.removeEventListener("pointermove", onPointerMove)
            canvas.removeEventListener("pointerup", finishDrag)
            canvas.removeEventListener("pointercancel", finishDrag)
            canvas.removeEventListener("carousel-previous", onCarouselPrevious)
            canvas.removeEventListener("carousel-next", onCarouselNext)
            window.removeEventListener("keydown", onKeyDown)

            cleanupImages(images)
        }
    }, [
        canvasRef,
        imagePrefix,
        pages,
        canvasWidth,
        canvasHeight,
        centerY,
        radiusX,
        radiusY,
        sideScale,
        centerScale,
        dragSensitivity,
        animationDuration,
    ])

    return { centerIndex }
}

const wrapIndex = (index: number, length: number): number =>
    length > 0 ? ((index % length) + length) % length : 0

const preloadCarouselImages = (
    prefix: string,
    expectedCount: number,
    onLoadSingle: () => void,
    onError: (index: number, src: string) => void
): HTMLImageElement[] => {
    const images: HTMLImageElement[] = []

    for (let i = 0; i < expectedCount; i++) {
        const image = new Image()
        const src = `${prefix}${String(i).padStart(3, "0")}.png`

        image.onload = onLoadSingle
        image.onerror = () => onError(i, src)
        image.src = src

        images.push(image)
    }

    return images
}

const cleanupImages = (images: HTMLImageElement[]) => {
    images.forEach(img => {
        img.onload = null
        img.onerror = null
    })
}

const drawTabletop = (
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    rotation: number
) => {
    ctx.save()

    const centerX = canvasWidth / 2
    const tableCenterY = centerY - 20
    const tableRadiusX = radiusX + 40
    const tableRadiusY = radiusY + 20

    // Table shadow
    ctx.fillStyle = "#bd8269"
    ctx.beginPath()
    ctx.ellipse(
        centerX,
        tableCenterY + 8,
        tableRadiusX,
        tableRadiusY,
        0,
        0,
        Math.PI * 2
    )
    ctx.fill()

    // Table surface
    ctx.fillStyle = "#dbb57a"
    ctx.beginPath()
    ctx.ellipse(
        centerX,
        tableCenterY,
        tableRadiusX,
        tableRadiusY,
        0,
        0,
        Math.PI * 2
    )
    ctx.fill()

    // Table outline
    ctx.strokeStyle = "#5e4f5d"
    ctx.lineWidth = 2
    ctx.stroke()

    // Clip markings
    ctx.beginPath()
    ctx.ellipse(
        centerX,
        tableCenterY,
        tableRadiusX,
        tableRadiusY,
        0,
        0,
        Math.PI * 2
    )
    ctx.clip()

    // Rotating radial markings
    ctx.strokeStyle = "#bd8269"
    ctx.lineWidth = 1
    const segments = 8

    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2 + rotation
        ctx.beginPath()
        ctx.moveTo(centerX, tableCenterY)
        ctx.lineTo(
            centerX + Math.sin(angle) * tableRadiusX,
            tableCenterY + Math.cos(angle) * tableRadiusY
        )
        ctx.stroke()
    }

    ctx.restore()
}

const drawSpriteItem = (
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    image: HTMLImageElement | undefined,
    page: CarouselPage | undefined,
    angle: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    sideScale: number,
    centerScale: number
) => {
    if (!image || !image.complete || image.naturalWidth === 0) return

    const x = canvasWidth / 2 + radiusX * Math.sin(angle)
    const y = centerY - radiusY * (1 - Math.cos(angle))
    const depth = (Math.cos(angle) + 1) / 2
    const scale = sideScale + (centerScale - sideScale) * depth

    const width = image.width * scale
    const height = image.height * scale
    const left = x - width / 2
    const top = y - height / 2

    const brightness = 65 + depth * 35

    ctx.save()
    ctx.filter = `brightness(${brightness}%)`
    ctx.drawImage(image, left, top, width, height)
    ctx.restore()

    if (page) {
        ctx.save()
        ctx.font = "bold 12px Merriweather"
        ctx.textAlign = "center"
        ctx.textBaseline = "bottom"
        ctx.fillStyle = `rgba(94, 79, 93, ${0.65 + depth * 0.35})`
        ctx.fillText(page.title, x, top)
        ctx.restore()
    }
}
