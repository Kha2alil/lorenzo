async function submitContact(e) {
  e.preventDefault();
  const name = document.getElementById('contactName').value.trim();
  const phone = document.getElementById('contactPhone').value.trim();
  const email = document.getElementById('contactEmail').value.trim();
  const message = document.getElementById('contactMessage').value.trim();
  const status = document.getElementById('contactStatus');

  if (!name || !phone || !message) {
    status.textContent = t('contact.fill');
    status.style.color = 'var(--error)';
    return false;
  }

  try {
    const res = await fetch(API_BASE + '/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email: email || undefined, message })
    });

    if (!res.ok) throw new Error('Failed to send message');

    status.textContent = t('contact.sent');
    status.style.color = '#2E7D32';
    document.getElementById('contactForm').reset();
  } catch (err) {
    status.textContent = t('contact.error');
    status.style.color = 'var(--error)';
  }

  return false;
}
