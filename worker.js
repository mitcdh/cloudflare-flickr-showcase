// const CACHE_NAME = 'flickr-images-cache-v1'; // Name of the cache storage
// const CACHE_EXPIRATION = 86400; // Cache expiration time in seconds (24 hours)
// const NUM_IMAGES = 6; // Number of images to cache and serve
// const REDIRECT_DOMAIN = 'https://example.com'; // Domain to redirect unmatched requests to
// const FLICKR_API_KEY = 'YOUR_API_KEY'; // Flickr API key (replace with your own)
// const FLICKR_PHOTOSET_ID = 'YOUR_PHOTOSET_ID'; // Flickr photoset ID (replace with your own)

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  console.debug("Handling request for pathname:", pathname);

  // Check if the request matches the pattern for an image (/1.jpg, /2.jpg, etc.)
  const imageMatch = /^\/(\d+)\.jpg$/.exec(pathname);
  if (imageMatch) {
    const imageNumber = parseInt(imageMatch[1]);
    console.debug("Image number:", imageNumber);

    if (imageNumber <= 0 || imageNumber > NUM_IMAGES) {
      console.debug("Image number out of range, returning 404");
      return new Response('Image not found', { status: 404 });
    }

    console.debug("Valid image number, proceeding with cache check");
    const cache = await caches.open(CACHE_NAME);
    let cachedResponse = await cache.match(request);

    // Trigger caching if the requested image is not cached already
    if (!cachedResponse) {
      console.debug("No cached response found for URL:", url.toString());
      await cacheRandomImages(request);
      // Try to get the cached response again after caching
      cachedResponse = await cache.match(request);
    }

    // If the cached response is found, return it
    if (cachedResponse) {
      console.debug("Returning cached response for URL:", url.toString());
      return cachedResponse;
    } else {
      console.debug("No cached response found after caching, returning 404");
      return new Response('Image not found', { status: 404 });
    }
  }

  // Route for manually updating cache
  if (pathname === '/update-cache') {
    console.debug("Updating cache via /update-cache route");
    await cacheRandomImages(request);
    return new Response('Cache updated successfully', { status: 200 });
  }

  // Redirect any other request to the specified domain
  console.debug("No matching route found, redirecting to:", REDIRECT_DOMAIN);
  return Response.redirect(REDIRECT_DOMAIN, 302);
}

async function fetchPhotosFromFlickr() {
  const apiKey = FLICKR_API_KEY; 
  const photoSetId = FLICKR_PHOTOSET_ID;
  const apiUrl = `https://api.flickr.com/services/rest/?method=flickr.photosets.getPhotos&api_key=${apiKey}&photoset_id=${photoSetId}&format=json&nojsoncallback=1&extras=url_l`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    // If the Flickr API response is successful, return the photos
    if (data.stat === 'ok') {
      return data.photoset.photo;
    } else {
      console.error("Flickr API returned an error:", data);
      return [];
    }
  } catch (error) {
    console.error('Error fetching from Flickr API:', error);
    return [];
  }
}

async function cacheRandomImages(originalRequest) {
  console.debug("Caching random images from Flickr API");
  const photos = await fetchPhotosFromFlickr();
  const randomPhotos = getRandomPhotos(photos, NUM_IMAGES);

  const cache = await caches.open(CACHE_NAME);

  const cachePromises = randomPhotos.map(async (photo, i) => {
    if (photo && photo.url_l) {
      const imageName = `${i + 1}.jpg`;
      const imageUrl = photo.url_l;
      const imageRequest = new Request(`${new URL(originalRequest.url).origin}/${imageName}`);
      const imageResponse = await fetch(imageUrl);

      // Set cache headers on the response before caching
      const cachedResponse = new Response(imageResponse.body, {
        headers: {
          'Cache-Control': `max-age=${CACHE_EXPIRATION}`,
          ...imageResponse.headers,
        },
      });

      await cache.put(imageRequest, cachedResponse);
      console.debug(`Cached ${imageName}:`, {
        requestUrl: imageRequest.url,
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        flickrUrl: imageUrl
      });
    } else {
      console.warn(`Skipping photo ${i + 1} due to missing url_l property`);
    }
  });

  await Promise.all(cachePromises);
}

function getRandomPhotos(photos, count) {
  const shuffled = photos.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}