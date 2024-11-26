// const CACHE_NAME = 'flickr-images-cache-v1';
// const CACHE_EXPIRATION = 86400;
// const NUM_IMAGES = 6;
// const REDIRECT_DOMAIN = 'https://example.com';
// const FLICKR_API_KEY = 'YOUR_API_KEY';
// const FLICKR_PHOTOSET_ID = 'YOUR_PHOTOSET_ID';

addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const imageMatch = /^\/(\d+)\.jpg$/.exec(url.pathname);

  if (url.pathname === '/photos.json') {
    event.respondWith(handleJSONRequest(event.request));
  } else if (imageMatch) {
    event.respondWith(handleRequest(event.request, parseInt(imageMatch[1])));
  } else {
    console.debug('No matching route, redirecting to:', REDIRECT_DOMAIN);
    event.respondWith(Response.redirect(REDIRECT_DOMAIN, 302));
  }
});

async function handleJSONRequest(request) {
  console.debug('Fetching photos.json');
  const cache = await caches.open(CACHE_NAME);
  const cachedJSON = await cache.match(request);

  if (cachedJSON) {
    console.debug('Returning cached photos.json');
    return cachedJSON;
  }

  console.debug('No cached photos.json, fetching from Flickr API');
  const allPhotos = await fetchJSONFromFlickr();

  if (!allPhotos.length) {
    console.debug('No photos available');
    return new Response('[]', {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${CACHE_EXPIRATION}`
      }
    });
  }

  // Randomly select NUM_IMAGES URLs
  const selectedPhotos = shuffleArray(allPhotos).slice(0, NUM_IMAGES);

  const response = new Response(JSON.stringify(selectedPhotos), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `max-age=${CACHE_EXPIRATION}`
    }
  });

  await cache.put(request, response.clone());
  console.debug('Cached and returning fresh photos.json');
  return response;
}

async function handleRequest(request, imageNumber) {
  console.debug('Handling request:', { url: request.url, imageNumber });
  
  if (imageNumber <= 0 || imageNumber > NUM_IMAGES) {
      console.debug('Image number out of range:', { imageNumber, max: NUM_IMAGES });
      return Response.redirect(REDIRECT_DOMAIN, 302);
  }

  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
      console.debug('Cache hit:', { url: request.url, status: cachedResponse.status });
      return cachedResponse;
  }

  const photosRequest = new Request(`${new URL(request.url).origin}/photos.json`);
  const photoResponse = await handleJSONRequest(photosRequest);
  const photos = await photoResponse.json();

  if (!photos.length || !photos[imageNumber - 1]) {
      console.debug('Invalid or missing photo URL, redirecting to fallback');
      return Response.redirect(`${REDIRECT_DOMAIN}/${imageNumber}.jpg`, 302);
  }

  return fetchAndCacheImage(request, photos[imageNumber - 1].url, imageNumber);
}

async function fetchJSONFromFlickr() {
  console.debug('Fetching photos from Flickr API');
  
  const apiUrl = `https://api.flickr.com/services/rest/?method=flickr.photosets.getPhotos&api_key=${FLICKR_API_KEY}&photoset_id=${FLICKR_PHOTOSET_ID}&format=json&nojsoncallback=1&extras=url_l,description,title`;

  try {
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (data.stat === 'ok') {
          const photos = data.photoset.photo
              .filter(photo => photo.url_l)
              .map(photo => ({
                  url: photo.url_l,
                  title: photo.title,
                  description: photo.description._content || '',
              }));

          console.debug('Flickr API response:', { 
              totalPhotos: data.photoset.photo.length, 
              validPhotos: photos.length 
          });
          return photos;
      }
      
      console.error('Flickr API error:', data);
      return [];
      
  } catch (error) {
      console.error('Error fetching from Flickr API:', error);
      return [];
  }
}

async function fetchAndCacheImage(request, imageUrl, imageNumber) {
  console.debug('Fetching and caching image:', imageUrl);

  const cache = await caches.open(CACHE_NAME);
  
  try {
      const imageResponse = await fetch(imageUrl, { 
          'Referer': REDIRECT_DOMAIN
      });

      if (!imageResponse.ok) {
          console.debug('Image cache failed, redirecting to Flickr', {
              requestUrl: imageResponse.url,
              status: imageResponse.status,
              statusText: imageResponse.statusText
          });
          return Response.redirect(imageUrl, 302);
      }

      const response = new Response(imageResponse.body, {
          headers: new Headers({
              ...Object.fromEntries(imageResponse.headers),
              'Cache-Control': `max-age=${CACHE_EXPIRATION}`
          })
      });

      await cache.put(request, response.clone());
      console.debug('Successfully cached image:', request.url);
      
      return response;
      
  } catch (error) {
      console.error('Error fetching/caching image, redirecting to fallback:', error);
      return Response.redirect(`${REDIRECT_DOMAIN}/${imageNumber}.jpg`, 302);
  }
}

// Utility function to shuffle an array
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}