import * as React from "react"

import Layout from "../components/layout"
import Seo from "../components/seo"
import PixelCarousel from "../components/pixel-carousel"
import { PageProps } from "gatsby"

const LandingPage = ({ location }: PageProps) => {
    const header = `Welcome to Lam's Kitchen`

    return (
        <Layout location={location} title={header}>
            <PixelCarousel />
        </Layout>
    )
}

export default LandingPage

/**
 * Head export to define metadata for the page
 *
 * See: https://www.gatsbyjs.com/docs/reference/built-in-components/gatsby-head/
 */
export const Head = () => <Seo title="All posts" />
