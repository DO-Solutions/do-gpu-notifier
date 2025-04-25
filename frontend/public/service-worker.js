// This service worker handles push notifications

self.addEventListener('push', function(event) {
  if (!event.data) {
    console.log('Push event but no data');
    return;
  }
  
  const data = event.data.json();
  
  const title = data.title || 'GPU Availability Update';
  const options = {
    body: data.body || 'A GPU is now available on DigitalOcean!',
    icon: '/logo192.png',
    badge: '/badge.png',
    data: data.data
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  // Open the DigitalOcean droplet creation page or custom URL if provided
  const urlToOpen = event.notification.data?.url || 'https://cloud.digitalocean.com/droplets/new';
  
  event.waitUntil(
    clients.openWindow(urlToOpen)
  );
});

