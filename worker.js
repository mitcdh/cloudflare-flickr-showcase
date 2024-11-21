// const CACHE_NAME = 'flickr-images-cache-v1'; // Name of the cache storage
// const CACHE_EXPIRATION = 86400; // Cache expiration time in seconds (24 hours)
// const NUM_IMAGES = 6; // Number of images to cache and serve
// const REDIRECT_DOMAIN = 'https://example.com'; // Domain to redirect unmatched requests to
// const FLICKR_API_KEY = 'YOUR_API_KEY'; // Flickr API key (replace with your own)
// const FLICKR_PHOTOSET_ID = 'YOUR_PHOTOSET_ID'; // Flickr photoset ID (replace with your own)

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const imageMatch = /^\/(\d+)\.jpg$/.exec(url.pathname);

  // Validate image number early to avoid unnecessary cache operations
  if (imageMatch) {
    const imageNumber = parseInt(imageMatch[1]);
    if (imageNumber <= 0 || imageNumber > NUM_IMAGES) {
      return new Response("Image not found", {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      });
    }
  }

  const cache = await caches.open(CACHE_NAME);

  if (imageMatch) {
    return handleImageRequest(cache, request);
  }

  if (url.pathname === "/update-cache") {
    await cacheRandomImages(cache, request);
    return new Response("Cache updated", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return Response.redirect(REDIRECT_DOMAIN, 302);
}

async function handleImageRequest(cache, request) {
  const response = await cache.match(request);

  if (response) {
    return response;
  }

  await cacheRandomImages(cache, request);
  const cachedResponse = await cache.match(request);

  return (
    cachedResponse ||
    new Response("Image not found", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    })
  );
}

async function fetchPhotosFromFlickr() {
  const params = new URLSearchParams({
    method: "flickr.photosets.getPhotos",
    api_key: FLICKR_API_KEY,
    photoset_id: FLICKR_PHOTOSET_ID,
    format: "json",
    nojsoncallback: "1",
    extras: "url_l",
  });

  try {
    const response = await fetch(
      `https://api.flickr.com/services/rest/?${params}`
    );
    const data = await response.json();
    return data.stat === "ok" ? data.photoset.photo : [];
  } catch {
    return [];
  }
}

async function cacheRandomImages(cache, originalRequest) {
  const photos = await fetchPhotosFromFlickr();
  const baseUrl = new URL(originalRequest.url).origin;
  const randomPhotos = photos
    .sort(() => Math.random() - 0.5)
    .slice(0, NUM_IMAGES)
    .filter((photo) => photo?.url_l);

  await Promise.all(
    randomPhotos.map(async (photo, i) => {
      const imageRequest = new Request(`${baseUrl}/${i + 1}.jpg`);
      const imageResponse = await fetch(photo.url_l);

      const cachedResponse = new Response(imageResponse.body, {
        headers: {
          ...imageResponse.headers,
          "Cache-Control": `public, max-age=${CACHE_EXPIRATION}`,
          "Content-Type": "image/jpeg",
        },
      });

      await cache.put(imageRequest, cachedResponse);
    })
  );
}
