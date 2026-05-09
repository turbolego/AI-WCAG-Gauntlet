const navLinks = document.querySelectorAll("nav a");
const navButton = document.querySelector("button[aria-haspopup="true]");
navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const href = link.getAttribute("href");
    document.querySelector(href).scrollIntoView({
      behavior: "smooth",
    });
  });
});
avButton.addEventListener("click", () => {
  const nav = document.getElementById("nav");
  nav.classList.toggle("active");
  if (nav.classList.contains("active")) {
    navButton.setAttribute("aria-expanded", "true");
  } else {
    navButton.setAttribute("aria-expanded", "false");
  }
});
