gsap.registerPlugin(ScrollTrigger);

// ==========================================
// CONFIGURATION
// ==========================================
const TOTAL_FRAMES = 240; // UPDATE THIS: Match the number of images in your /frames/ folder
const SCROLL_DISTANCE = 4000; // Approximate total scroll distance in pixels

// ==========================================
// DOM ELEMENTS
// ==========================================
const canvas = document.getElementById("frame-canvas");
const ctx = canvas.getContext("2d");
const progressBar = document.getElementById("progress-bar");
const scrollIndicator = document.getElementById("scroll-indicator");
const nav = document.querySelector(".navbar");

// ==========================================
// CANVAS & RENDERING LOGIC
// ==========================================
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderFrame(currentFrameIndex);
}
window.addEventListener("resize", resizeCanvas);

// Image Preloading
const frames = [];
let imagesLoaded = 0;
let currentFrameIndex = 0;

for (let i = 1; i <= TOTAL_FRAMES; i++) {
    const img = new Image();
    // Assuming frames are named ezgif-frame-001.jpg, etc.
    const frameNumber = i.toString().padStart(3, '0');
    img.src = `./frames/ezgif-frame-${frameNumber}.png`;
    img.onload = () => {
        imagesLoaded++;
        if (imagesLoaded === 1) {
            // Draw first frame immediately to prevent blank screen
            resizeCanvas();
        }
    };
    // Fallback if image fails to load
    img.onerror = () => {
        console.warn(`Frame ${frameNumber} failed to load. Please check your /frames/ folder.`);
    };
    frames.push(img);
}

function renderFrame(index) {
    if (frames[index] && frames[index].complete && frames[index].naturalWidth > 0) {
        const img = frames[index];
        
        // Calculate object-fit: cover equivalent for canvas
        const canvasRatio = canvas.width / canvas.height;
        const imgRatio = img.width / img.height;
        
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (canvasRatio > imgRatio) {
            drawWidth = canvas.width;
            drawHeight = canvas.width / imgRatio;
            offsetX = 0;
            offsetY = (canvas.height - drawHeight) / 2;
        } else {
            drawHeight = canvas.height;
            drawWidth = canvas.height * imgRatio;
            offsetX = (canvas.width - drawWidth) / 2;
            offsetY = 0;
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    }
}

// ==========================================
// GSAP SCROLL ANIMATIONS
// ==========================================
window.addEventListener("load", () => {
    // Initial size setup
    resizeCanvas();

    // Ensure initial stage is visible
    gsap.set("#stage-1", { opacity: 1, y: 0 });

    // 1. Main Scrubbing, Pinning & Animations Timeline
    const masterTl = gsap.timeline({
        scrollTrigger: {
            trigger: "#main-container",
            start: "top top",
            end: `+=${SCROLL_DISTANCE}`,
            pin: true,
            scrub: 0.5,
            onUpdate: (self) => {
                // Map scroll progress (0 to 1) to frame index
                currentFrameIndex = Math.min(
                    TOTAL_FRAMES - 1,
                    Math.floor(self.progress * TOTAL_FRAMES)
                );
                
                // Render frame via requestAnimationFrame for performance
                requestAnimationFrame(() => renderFrame(currentFrameIndex));

                // Update Progress Bar
                progressBar.style.width = `${self.progress * 100}%`;
                
                // Fade out scroll indicator in the first 10%
                if (self.progress > 0.1) {
                    scrollIndicator.style.opacity = 0;
                } else {
                    scrollIndicator.style.opacity = 1 - (self.progress * 10);
                }

                // Manage pointer events manually for best reliability
                const stage1 = document.getElementById("stage-1");
                const stage2 = document.getElementById("stage-2");
                const stage3 = document.getElementById("stage-3");
                const stage4 = document.getElementById("stage-4");
                
                stage1.classList.toggle("active", self.progress < 0.25);
                stage2.classList.toggle("active", self.progress >= 0.25 && self.progress < 0.5);
                stage3.classList.toggle("active", self.progress >= 0.5 && self.progress < 0.75);
                stage4.classList.toggle("active", self.progress >= 0.75);
                
                // Removed finalCta reference which was undefined
            }
        }
    });

    // 2. Text Transitions within Master Timeline
    // Master timeline goes from 0 to 1 based on absolute scroll percentage
    
    // Stage 1 fades out between 20% and 25%
    masterTl.to("#stage-1", { opacity: 0, y: -50, duration: 0.05, ease: "power2.inOut" }, 0.20);
    
    // Stage 2 fades in at 25%, fades out at 45%
    masterTl.fromTo("#stage-2", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.05, ease: "power2.out" }, 0.25)
            .to("#stage-2", { opacity: 0, y: -50, duration: 0.05, ease: "power2.in" }, 0.45);

    // Stage 3 fades in at 50%, fades out at 70%
    masterTl.fromTo("#stage-3", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.05, ease: "power2.out" }, 0.50)
            .to("#stage-3", { opacity: 0, y: -50, duration: 0.05, ease: "power2.in" }, 0.70);

    // Stage 4 fades in at 75%, stays till 95%
    masterTl.fromTo("#stage-4", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.05, ease: "power2.out" }, 0.75)
            .to("#stage-4", { opacity: 0, y: -50, duration: 0.05, ease: "power2.in" }, 0.95);

    // ==========================================
    // NEW SECTIONS LOGIC (Moved inside onload)
    // ==========================================

    // Scroll Reveal for New Sections
    gsap.utils.toArray(".reveal-section").forEach(section => {
        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: section,
                start: "top 85%",
                once: true
            }
        });

        // Make section visible instantly before animating children
        tl.to(section, { autoAlpha: 1, duration: 0.1 });

        // Select animate-able children
        const headers = section.querySelectorAll(".section-header h2, .section-header p, .timeline-line");
        const cards = section.querySelectorAll(".project-card, .counter-box, .timeline-item, .pricing-card, .masonry-item, .contact-card");

        if(headers.length > 0) {
            tl.from(headers, {
                y: 40,
                opacity: 0,
                duration: 1,
                stagger: 0.2,
                ease: "power3.out"
            });
        }

        if(cards.length > 0) {
            tl.from(cards, {
                y: 60,
                opacity: 0,
                duration: 1,
                stagger: 0.15,
                ease: "power3.out"
            }, "-=0.6");
        }
    });

    // Animated Counters
    const counters = document.querySelectorAll(".counter");
    counters.forEach(counter => {
        ScrollTrigger.create({
            trigger: counter,
            start: "top 85%",
            once: true,
            onEnter: () => {
                const target = +counter.getAttribute("data-target");
                gsap.to(counter, {
                    innerHTML: target,
                    duration: 2,
                    ease: "power2.out",
                    snap: { innerHTML: 1 },
                    onUpdate: function() {
                        counter.innerHTML = Math.round(this.targets()[0].innerHTML);
                    }
                });
            }
        });
    });

    // Ensure ScrollTrigger recalculates everything properly
    ScrollTrigger.refresh();
});

// ==========================================
// NAVBAR SCROLL EFFECT
// ==========================================
window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
        nav.classList.add("scrolled");
    } else {
        nav.classList.remove("scrolled");
    }
});

// ==========================================
// NEW SECTIONS LOGIC
// ==========================================

// Custom Cursor
const cursor = document.getElementById("custom-cursor");
document.addEventListener("mousemove", (e) => {
    if(cursor) {
        cursor.style.left = e.clientX + "px";
        cursor.style.top = e.clientY + "px";
    }
});

// (Moved reveal animations and counters into window.onload above)

// Lightbox Logic
let currentLightboxIndex = 0;
const masonryItems = document.querySelectorAll('.masonry-item img');

window.openLightbox = function(element) {
    const lightbox = document.getElementById("lightbox");
    const lightboxImg = document.getElementById("lightbox-img");
    const lightboxCaption = document.getElementById("lightbox-caption");
    
    const img = element.querySelector("img");
    const caption = element.querySelector("p").innerText;
    
    // Find index
    masonryItems.forEach((item, index) => {
        if(item.src === img.src) currentLightboxIndex = index;
    });

    lightboxImg.src = img.src;
    lightboxCaption.innerText = caption;
    lightbox.classList.add("active");
}

window.closeLightbox = function() {
    document.getElementById("lightbox").classList.remove("active");
}

window.changeLightbox = function(direction) {
    currentLightboxIndex += direction;
    if(currentLightboxIndex < 0) currentLightboxIndex = masonryItems.length - 1;
    if(currentLightboxIndex >= masonryItems.length) currentLightboxIndex = 0;
    
    const newImg = masonryItems[currentLightboxIndex];
    const newCaption = newImg.nextElementSibling.querySelector("p").innerText;
    
    document.getElementById("lightbox-img").src = newImg.src;
    document.getElementById("lightbox-caption").innerText = newCaption;
}

// Form Validation
const bookingForm = document.getElementById("booking-form");
if(bookingForm) {
    bookingForm.addEventListener("submit", (e) => {
        e.preventDefault();
        
        // Show success message
        document.getElementById("form-success").style.display = "block";
        bookingForm.reset();
        
        // Hide success message after 5 seconds
        setTimeout(() => {
            document.getElementById("form-success").style.display = "none";
        }, 5000);
    });
}
