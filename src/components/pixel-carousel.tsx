import * as React from "react"
import { CarouselPage, useCarousel } from "./helpers/generate-carousel"

interface PixelCarouselProps {
    imagePrefix?: string
    pages?: CarouselPage[]
}

const DEFAULT_PAGES: CarouselPage[] = [
    { title: "Writings", url: "/writings/" },
    { title: "Projects", url: "/projects/" },
    { title: "About Me", url: "/about/" },
    { title: "Book List", url: "/contact/" },
]

const CANVAS_WIDTH = 320
const CANVAS_HEIGHT = 200
const RADIUS_X = 105
const RADIUS_Y = 38
const CENTER_Y = 120
const CENTER_SCALE = 0.25
const SIDE_SCALE = 0.1
const DRAG_SENSITIVITY = 0.006
const ANIMATION_DURATION = 350

export default function PixelCarousel({
    imagePrefix = "./dimsums",
    pages = DEFAULT_PAGES,
}: PixelCarouselProps) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null)

    const { centerIndex } = useCarousel({
        canvasRef,
        pages,
        imagePrefix,
        canvasWidth: CANVAS_WIDTH,
        canvasHeight: CANVAS_HEIGHT,
        centerY: CENTER_Y,
        radiusX: RADIUS_X,
        radiusY: RADIUS_Y,
        sideScale: SIDE_SCALE,
        centerScale: CENTER_SCALE,
        dragSensitivity: DRAG_SENSITIVITY,
        animationDuration: ANIMATION_DURATION,
    })

    const currentPage = pages[centerIndex] ?? pages[0]

    if (!currentPage) return null

    const goToPage = () => {
        window.location.href = currentPage.url
    }

    return (
        <section className="pixel-carousel">
            <canvas ref={canvasRef} />

            <div className="carousel-controls">
                <div className="carousel-navigation">
                    <button
                        type="button"
                        className="previous"
                        aria-label="Previous page"
                        onClick={() => {
                            canvasRef.current?.dispatchEvent(
                                new Event("carousel-previous")
                            )
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
                            )
                        }}
                    >
                        →
                    </button>
                </div>

                <p className="carousel-hint">Drag or ← / → to browse</p>
            </div>
        </section>
    )
}
