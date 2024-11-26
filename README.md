# Flickr Showcase Cloudflare Worker

This Cloudflare Worker regularly fetches random images from a Flickr photoset, caching them at the edge for fast delivery with friendly urls (`/1.jpg`, `/2.jpg`, etc.) so they can be easily linked in, for example, a static blog.

## Setup

1. Clone this repository to your local machine.
2. Install the Cloudflare Wrangler CLI if you haven't already: `npm install -g @cloudflare/wrangler`
3. Authenticate Wrangler with your Cloudflare account: `wrangler login`
4. Open the `wrangler.toml` file and replace the following placeholders with your own values (or edit directly in worker.js and upload into the worker through the cloudflare dashboard):
    - `<YOUR_ACCOUNT_ID>`: Your Cloudflare account ID
    - `<YOUR_FLICKR_API_KEY>`: Your Flickr API key
    - `<YOUR_FLICKR_PHOTOSET_ID>`: The ID of the Flickr photoset to use
    - `<REDIRECT_DOMAIN>`: The domain to redirect unmatched requests to
5. (Optional) Modify the other configuration variables in `wrangler.toml` as needed:
    - `CACHE_NAME`: The name of the cache to use
    - `CACHE_EXPIRATION`: The cache expiration time in seconds
    - `NUM_IMAGES`: The number of images to cache and serve
6. Publish the Worker to Cloudflare: `wrangler publish`

## Usage

Once deployed, the Worker will be available at a URL like `https://flickr-showcase.<your-subdomain>.workers.dev`.

- To view a cached image, visit `/1.jpg`, `/2.jpg`, etc.
- Any other URL will redirect to the configured `REDIRECT_DOMAIN`.
- Cache failures will redirect to the flickr url without caching.
- Any other failures will redirect to the `REDIRECT_DOMAIN/*.jpg` with the user provided image number.

## Development

To run the Worker locally for development:

1. Start the local development server: `wrangler dev`
2. The Worker will be available at `http://localhost:8787`.
