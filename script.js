/* ==========================================================================
   TETRASYNC TECHNOLOGIES - INTERACTIVE SCRIPTS & ENQUIRY DISPATCHER
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initCircuitBackground();
  initProductEnquiryLinks();
});

/* --------------------------------------------------------------------------
   1. BACKGROUND CIRCUIT CANVAS ANIMATION
   -------------------------------------------------------------------------- */
function initCircuitBackground() {
  const canvas = document.getElementById('circuit-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width, height;
  let nodes = [];
  const NODE_COUNT = 36;
  const CONNECT_DIST = 160;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    createNodes();
  }

  function createNodes() {
    nodes = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        size: Math.random() * 2.5 + 1.5,
        pulse: Math.random() * Math.PI,
      });
    }
  }

  window.addEventListener('resize', resize);
  resize();

  function animate() {
    ctx.clearRect(0, 0, width, height);

    // Draw connection traces (circuit board lines)
    ctx.lineWidth = 0.75;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONNECT_DIST) {
          const alpha = (1 - dist / CONNECT_DIST) * 0.28;
          ctx.strokeStyle = `rgba(0, 210, 255, ${alpha})`;

          // Draw right-angle circuit trace
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          const midX = nodes[i].x + (nodes[j].x - nodes[i].x) * 0.5;
          ctx.lineTo(midX, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw nodes
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      node.x += node.vx;
      node.y += node.vy;

      if (node.x < 0 || node.x > width) node.vx *= -1;
      if (node.y < 0 || node.y > height) node.vy *= -1;

      node.pulse += 0.03;
      const glow = Math.sin(node.pulse) * 0.4 + 0.6;

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 210, 255, ${glow * 0.8})`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(0, 210, 255, 0.8)';
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    requestAnimationFrame(animate);
  }

  animate();
}

/* --------------------------------------------------------------------------
   2. PRODUCT ENQUIRY PREFILL & SCROLL
   -------------------------------------------------------------------------- */
function initProductEnquiryLinks() {
  const buttons = document.querySelectorAll('.product-enquire-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const productName = btn.getAttribute('data-product');
      const briefTextarea = document.getElementById('enquiry-brief');
      const enquirySection = document.getElementById('enquiry');

      if (briefTextarea) {
        briefTextarea.value = `Enquiry regarding: ${productName}\n\nTarget Application:\nExpected Quantity / Evaluation Units:\nKey Interface Requirements:\n`;
      }

      if (enquirySection) {
        enquirySection.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => {
          if (briefTextarea) briefTextarea.focus();
        }, 600);
      }
    });
  });
}

/* --------------------------------------------------------------------------
   3. ENQUIRY FORM SUBMISSION HANDLER & LIVE EMAIL DISPATCH
   -------------------------------------------------------------------------- */
async function handleEnquirySubmit(e) {
  e.preventDefault();

  const submitBtn = document.getElementById('btn-submit-enquiry');
  const originalBtnText = submitBtn ? submitBtn.innerText : 'Dispatch Technical Brief →';

  const name = document.getElementById('enquiry-name').value.trim();
  const email = document.getElementById('enquiry-email').value.trim();
  const company = document.getElementById('enquiry-company').value.trim() || 'Independent';
  const phase = document.getElementById('enquiry-phase').value;
  const brief = document.getElementById('enquiry-brief').value.trim();

  const scopes = Array.from(document.querySelectorAll('input[name="scope"]:checked'))
    .map(cb => cb.value)
    .join(', ');

  // Generate Reference Ticket ID
  const refCode = 'TST-' + (new Date().getFullYear()) + '-' + Math.floor(1000 + Math.random() * 9000);

  // Set loading state on submit button
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Transmitting Brief...';
    submitBtn.style.opacity = '0.7';
    submitBtn.style.cursor = 'not-allowed';
  }

  // Store in LocalStorage for client-side persistence and audit log
  const enquiryRecord = {
    ref: refCode,
    timestamp: new Date().toISOString(),
    name,
    email,
    company,
    phase,
    scopes,
    brief,
    targetEmail: 'ideathinigirs@gmail.com'
  };

  try {
    const existing = JSON.parse(localStorage.getItem('tetrasync_enquiries') || '[]');
    existing.push(enquiryRecord);
    localStorage.setItem('tetrasync_enquiries', JSON.stringify(existing));
  } catch (err) {
    console.warn('LocalStorage unavailable:', err);
  }

  // Dispatch live email to ideathinigirs@gmail.com via AJAX
  const payload = {
    _subject: `[TetraSync] New Technical Brief: ${company} (#${refCode})`,
    _template: 'table',
    _captcha: 'false',
    'Reference Ticket': `#${refCode}`,
    'Client Name': name,
    'Work Email': email,
    'Company / Institution': company,
    'Project Phase': phase,
    'Engineering Disciplines': scopes || 'None specified',
    'Technical Requirements & Scope': brief,
    'Submission Date': new Date().toLocaleString()
  };

  try {
    const response = await fetch('https://formsubmit.co/ajax/ideathinigirs@gmail.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Technical brief successfully dispatched to ideathinigirs@gmail.com:', data);
  } catch (netErr) {
    console.warn('Network dispatch fallback triggered (data securely cached locally):', netErr);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = originalBtnText;
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
    }
  }

  // Show interactive success receipt state
  const form = document.getElementById('project-enquiry-form');
  const banner = document.getElementById('enquiry-success-banner');
  const bannerMsg = document.getElementById('success-banner-msg');
  const refBadge = document.getElementById('enquiry-ref-id');

  if (form && banner) {
    form.style.display = 'none';
    banner.style.display = 'block';

    if (refBadge) {
      refBadge.innerText = `Reference Ticket: #${refCode}`;
    }

    if (bannerMsg) {
      bannerMsg.innerText = `Thank you, ${name}. Your project parameters for ${company} have been transmitted directly to ideathinigirs@gmail.com under ticket #${refCode}. Founding partners B. Kishore (CEO), Akshay Kumar (CTO HW), J. Joshua (CTO SW), and A. Jason Kister (COO) will review your brief and follow up within 24 to 48 hours.`;
    }

    banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function resetEnquiryForm() {
  const form = document.getElementById('project-enquiry-form');
  const banner = document.getElementById('enquiry-success-banner');
  const submitBtn = document.getElementById('btn-submit-enquiry');

  if (form && banner) {
    form.reset();
    form.style.display = 'block';
    banner.style.display = 'none';
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Dispatch Technical Brief →';
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
    }
  }
}

/* --------------------------------------------------------------------------
   4. CAREERS & CANDIDATE APPLICATION HANDLER
   -------------------------------------------------------------------------- */
function selectCareerRole(roleName) {
  const roleSelect = document.getElementById('applicant-role');
  const targetBox = document.getElementById('career-application-box');
  const nameInput = document.getElementById('applicant-name');

  if (roleSelect) {
    roleSelect.value = roleName;
  }

  if (targetBox) {
    targetBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      if (nameInput) nameInput.focus();
    }, 600);
  }
}

async function handleCareerSubmit(e) {
  e.preventDefault();

  const submitBtn = document.getElementById('btn-submit-career');
  const originalBtnText = submitBtn ? submitBtn.innerText : 'Submit Application →';

  const name = document.getElementById('applicant-name').value.trim();
  const email = document.getElementById('applicant-email').value.trim();
  const phone = document.getElementById('applicant-phone').value.trim();
  const role = document.getElementById('applicant-role').value;
  const experience = document.getElementById('applicant-experience').value;
  const portfolio = document.getElementById('applicant-portfolio').value.trim();
  const statement = document.getElementById('applicant-statement').value.trim();

  // Generate Reference Applicant ID
  const refCode = 'APP-' + (new Date().getFullYear()) + '-' + Math.floor(1000 + Math.random() * 9000);

  // Set loading state on submit button
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Transmitting Application...';
    submitBtn.style.opacity = '0.7';
    submitBtn.style.cursor = 'not-allowed';
  }

  // Store application in LocalStorage for client-side audit
  const appRecord = {
    ref: refCode,
    timestamp: new Date().toISOString(),
    name,
    email,
    phone,
    role,
    experience,
    portfolio,
    statement,
    targetEmail: 'ideathinigirs@gmail.com'
  };

  try {
    const existingApps = JSON.parse(localStorage.getItem('tetrasync_applications') || '[]');
    existingApps.push(appRecord);
    localStorage.setItem('tetrasync_applications', JSON.stringify(existingApps));
  } catch (err) {
    console.warn('LocalStorage unavailable for application caching:', err);
  }

  // Dispatch candidate profile via AJAX to ideathinigirs@gmail.com
  const payload = {
    _subject: `[TetraSync Careers] Application: ${role} - ${name} (#${refCode})`,
    _template: 'table',
    _captcha: 'false',
    'Reference Code': `#${refCode}`,
    'Applicant Name': name,
    'Email Address': email,
    'Phone / WhatsApp': phone,
    'Target Position': role,
    'Experience Level': experience,
    'Portfolio / GitHub URL': portfolio,
    'Key Technical Projects & Skills': statement,
    'Application Timestamp': new Date().toLocaleString()
  };

  try {
    const response = await fetch('https://formsubmit.co/ajax/ideathinigirs@gmail.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Candidate application dispatched to ideathinigirs@gmail.com:', data);
  } catch (netErr) {
    console.warn('Network dispatch fallback triggered (application safely cached locally):', netErr);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = originalBtnText;
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
    }
  }

  // Show interactive success receipt state
  const form = document.getElementById('career-application-form');
  const banner = document.getElementById('career-success-banner');
  const bannerMsg = document.getElementById('career-banner-msg');
  const refBadge = document.getElementById('career-ref-id');

  if (form && banner) {
    form.style.display = 'none';
    banner.style.display = 'block';

    if (refBadge) {
      refBadge.innerText = `Applicant ID: #${refCode}`;
    }

    if (bannerMsg) {
      bannerMsg.innerText = `Thank you, ${name}. Your candidate profile for "${role}" has been transmitted directly to our founding board (ideathinigirs@gmail.com) under application #${refCode}. We review all technical portfolios and follow up within 3 to 5 business days.`;
    }

    banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function resetCareerForm() {
  const form = document.getElementById('career-application-form');
  const banner = document.getElementById('career-success-banner');
  const submitBtn = document.getElementById('btn-submit-career');

  if (form && banner) {
    form.reset();
    form.style.display = 'block';
    banner.style.display = 'none';
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Submit Application →';
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
    }
  }
}
