gsap.registerPlugin(ScrollTrigger);

// ==========================================
// CONFIGURATION
// ==========================================
const TOTAL_FRAMES = 240;
const SCROLL_DISTANCE = 4000;
const FRAME_BUFFER = 5; // Load N frames ahead/behind current
const LAZY_LOAD_THRESHOLD = 3; // Start loading when within N frames

// ==========================================
// DOM ELEMENTS
// ==========================================
const canvas = document.getElementById("frame-canvas");
const ctx = canvas.getContext("2d");
const progressBar = document.getElementById("progress-bar");
const scrollIndicator = document.getElementById("scroll-indicator");
const nav = document.querySelector(".navbar");

// ==========================================
// LAZY LOADING FRAME MANAGER
// ==========================================
class LazyFrameManager {
    constructor(totalFrames) {
        this.totalFrames = totalFrames;
        this.frames = new Map(); // Only store loaded frames in memory
        this.loadingQueue = new Set();
        this.loadedCount = 0;
        this.currentFrameIndex = 0;
        this.isInitialLoadComplete = false;
    }

    getFramePath(index) {
        const frameNumber = (index + 1).toString().padStart(3, '0');
        // Try WebP first (30-40% smaller), fallback to PNG
        return `./frames/ezgif-frame-${frameNumber}.webp`;
    }

    getFramePathPNG(index) {
        const frameNumber = (index + 1).toString().padStart(3, '0');
        return `./frames/ezgif-frame-${frameNumber}.png`;
    }

    async loadFrame(index) {
        if (index < 0 || index >= this.totalFrames) return null;
        if (this.frames.has(index)) return this.frames.get(index);
        if (this.loadingQueue.has(index)) return null;

        this.loadingQueue.add(index);

        return new Promise((resolve) => {
            const img = new Image();
            
            // Try WebP first
            img.src = this.getFramePath(index);
            
            const onLoad = () => {
                this.frames.set(index, img);
                this.loadingQueue.delete(index);
                this.loadedCount++;
                
                // Show loading progress
                if (!this.isInitialLoadComplete && this.loadedCount % 10 === 0) {
                    console.log(`Loaded ${this.loadedCount} frames...`);
                }
                
                resolve(img);
            };

            const onError = () => {
                // Fallback to PNG if WebP fails
                img.src = this.getFramePathPNG(index);
                img.onload = onLoad;
                img.onerror = () => {
                    console.warn(`Frame ${index} failed to load (PNG fallback).`);
                    this.loadingQueue.delete(index);
                    resolve(null);
                };
            };

            img.onload = onLoad;
            img.onerror = onError;
        });
    }

    async preloadCriticalFrames() {
        console.log("Preloading first 20 frames...");
        const promises = [];
        for (let i = 0; i < Math.min(20, this.totalFrames); i++) {
            promises.push(this.loadFrame(i));
        }
        await Promise.all(promises);
        this.isInitialLoadComplete = true;
        console.log("Initial frames ready!");
    }

    async loadFrameWindow(centerIndex) {
        // Load frames around current position
        const start = Math.max(0, centerIndex - FRAME_BUFFER);
        const end = Math.min(this.totalFrames - 1, centerIndex + FRAME_BUFFER);

        const promises = [];
        for (let i = start; i <= end; i++) {
            if (!this.frames.has(i) && !this.loadingQueue.has(i)) {
                promises.push(this.loadFrame(i));
            }
        }

        if (promises.length > 0) {
            // Don't await, load in background
            Promise.all(promises).catch(err => console.warn("Background load error:", err));
        }
    }

    getFrame(index) {
        return this.frames.get(index) || null;
    }

    // Optional: Clear frames outside buffer to save memory
    releaseOldFrames(centerIndex) {
        const keepStart = Math.max(0, centerIndex - FRAME_BUFFER * 2);
        const keepEnd = Math.min(this.totalFrames - 1, centerIndex + FRAME_BUFFER * 2);

        for (let [frameIndex, frameImg] of this.frames.entries()) {
            if (frameIndex < keepStart || frameIndex > keepEnd) {
                this.frames.delete(frameIndex);
            }
        }
    }
}

const frameManager = new LazyFrameManager(TOTAL_FRAMES);

// ==========================================
// CANVAS & RENDERING LOGIC
// ==========================================
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderFrame(frameManager.currentFrameIndex);
}
window.addEventListener("resize", resizeCanvas);

function renderFrame(index) {
    const img = frameManager.getFrame(index);
    
    if (img && img.complete && img.naturalWidth > 0) {
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
    } else if (!img) {
        // Frame not loaded yet - show placeholder
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#666";
        ctx.font = "18px Inter";
        ctx.textAlign = "center";
        ctx.fillText("Loading frame...", canvas.width / 2, canvas.height / 2);
    }
}

// ==========================================
// GSAP SCROLL ANIMATIONS
// ==========================================
window.addEventListener("load", async () => {
    console.log("Page loaded, starting initialization...");
    
    // Initial canvas setup
    resizeCanvas();

    // Start preloading critical frames while page loads
    await frameManager.preloadCriticalFrames();

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
                const newFrameIndex = Math.min(
                    TOTAL_FRAMES - 1,
                    Math.floor(self.progress * TOTAL_FRAMES)
                );
                
                frameManager.currentFrameIndex = newFrameIndex;

                // Render current frame via requestAnimationFrame for performance
                requestAnimationFrame(() => renderFrame(newFrameIndex));

                // Lazy load frame window (critical optimization!)
                frameManager.loadFrameWindow(newFrameIndex);
                
                // Optional: release old frames to save memory (uncomment if memory is critical)
                // if (newFrameIndex % 10 === 0) {
                //     frameManager.releaseOldFrames(newFrameIndex);
                // }

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
            }
        }
    });

    // 2. Text Transitions within Master Timeline
    masterTl.to("#stage-1", { opacity: 0, y: -50, duration: 0.05, ease: "power2.inOut" }, 0.20);
    masterTl.fromTo("#stage-2", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.05, ease: "power2.out" }, 0.25)
            .to("#stage-2", { opacity: 0, y: -50, duration: 0.05, ease: "power2.in" }, 0.45);
    masterTl.fromTo("#stage-3", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.05, ease: "power2.out" }, 0.50)
            .to("#stage-3", { opacity: 0, y: -50, duration: 0.05, ease: "power2.in" }, 0.70);
    masterTl.fromTo("#stage-4", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.05, ease: "power2.out" }, 0.75)
            .to("#stage-4", { opacity: 0, y: -50, duration: 0.05, ease: "power2.in" }, 0.95);

    // ==========================================
    // SCROLL REVEAL SECTIONS
    // ==========================================
    gsap.utils.toArray(".reveal-section").forEach(section => {
        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: section,
                start: "top 85%",
                once: true
            }
        });

        tl.to(section, { autoAlpha: 1, duration: 0.1 });

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

    // ==========================================
    // ANIMATED COUNTERS
    // ==========================================
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
// CUSTOM CURSOR
// ==========================================
const cursor = document.getElementById("custom-cursor");
document.addEventListener("mousemove", (e) => {
    if(cursor) {
        cursor.style.left = e.clientX + "px";
        cursor.style.top = e.clientY + "px";
    }
});

// ==========================================
// LIGHTBOX
// ==========================================
let currentLightboxIndex = 0;
const masonryItems = document.querySelectorAll('.masonry-item img');

window.openLightbox = function(element) {
    const lightbox = document.getElementById("lightbox");
    const lightboxImg = document.getElementById("lightbox-img");
    const lightboxCaption = document.getElementById("lightbox-caption");
    
    const img = element.querySelector("img");
    const caption = element.querySelector("p").innerText;
    
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

// ==========================================
// FORM VALIDATION
// ==========================================
const bookingForm = document.getElementById("booking-form");
if(bookingForm) {
    bookingForm.addEventListener("submit", (e) => {
        e.preventDefault();
        
        document.getElementById("form-success").style.display = "block";
        bookingForm.reset();
        
        setTimeout(() => {
            document.getElementById("form-success").style.display = "none";
        }, 5000);
    });
}
