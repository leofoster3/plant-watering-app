(function () {
  "use strict";

  const storage = {
    get: function (key, fallback) {
      try {
        const saved = localStorage.getItem(key);
        return saved === null ? fallback : JSON.parse(saved);
      } catch (error) {
        return fallback; // storage blocked or broken: just carry on
      }
    },
    set: function (key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        // storage blocked (e.g. private window): ignore
      }
    }
  };

  function dateOffset(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  const storedPlants = storage.get("sproutPlants", null);
  let plants = Array.isArray(storedPlants) ? storedPlants : STARTER_PLANTS.map(function (plant) {
    return {
      id: plant.id,
      name: plant.name,
      interval: plant.interval,
      lastWatered: dateOffset(-plant.daysSinceWatered)
    };
  });
  let sitterRequests = storage.get("sproutSitterRequests", {});

  document.title = STARTUP.name;
  document.getElementById("brand-name").textContent = STARTUP.name;
  document.getElementById("tagline").textContent = STARTUP.tagline;
  document.getElementById("pitch").textContent = STARTUP.pitch;

  function showView() {
    const requested = (window.location.hash || "#home").slice(1);
    const views = document.querySelectorAll("[data-view]");
    const exists = Array.prototype.some.call(views, function (view) {
      return view.id === requested;
    });
    const current = exists ? requested : "home";

    views.forEach(function (view) {
      view.hidden = view.id !== current;
    });

    document.querySelectorAll("nav a").forEach(function (link) {
      if (link.getAttribute("href") === "#" + current) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", showView);

  function dayDifference(firstDate, secondDate) {
    const first = new Date(firstDate + "T00:00:00");
    const second = new Date(secondDate + "T00:00:00");
    return Math.round((second.getTime() - first.getTime()) / 86400000);
  }

  function daysUntilWater(plant) {
    const dueDate = dateOffset(plant.interval - dayDifference(plant.lastWatered, dateOffset(0)));
    return dayDifference(dateOffset(0), dueDate);
  }

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function savePlants() {
    storage.set("sproutPlants", plants);
    renderPlants();
    renderDashboard();
  }

  function waterPlant(id) {
    plants = plants.map(function (plant) {
      return plant.id === id ? Object.assign({}, plant, { lastWatered: dateOffset(0) }) : plant;
    });
    savePlants();
  }

  function removePlant(id) {
    plants = plants.filter(function (plant) { return plant.id !== id; });
    savePlants();
  }

  function statusFor(plant) {
    const remaining = daysUntilWater(plant);
    if (remaining < 0) return { text: "Overdue by " + Math.abs(remaining) + (Math.abs(remaining) === 1 ? " day" : " days"), className: "status overdue" };
    if (remaining === 0) return { text: "Due today", className: "status due" };
    return { text: "In " + remaining + (remaining === 1 ? " day" : " days"), className: "status" };
  }

  function makePlantRow(plant, compact) {
    const row = createElement(compact ? "li" : "article", compact ? "care-item" : "plant-item");
    const details = createElement("div", "plant-details");
    const name = createElement("h3", "", plant.name);
    const frequency = createElement("p", "plant-frequency", "Every " + plant.interval + " days");
    const status = statusFor(plant);
    const badge = createElement("span", status.className, status.text);
    details.append(name, frequency);
    row.append(details, badge);

    if (!compact) {
      const actions = createElement("div", "plant-actions");
      const waterButton = createElement("button", "button small-button", "Watered");
      waterButton.type = "button";
      waterButton.addEventListener("click", function () { waterPlant(plant.id); });
      const removeButton = createElement("button", "remove-button", "Remove");
      removeButton.type = "button";
      removeButton.setAttribute("aria-label", "Remove " + plant.name);
      removeButton.addEventListener("click", function () { removePlant(plant.id); });
      actions.append(waterButton, removeButton);
      row.append(actions);
    }
    return row;
  }

  function renderPlants() {
    const list = document.getElementById("plant-list");
    list.replaceChildren.apply(list, plants.map(function (plant) { return makePlantRow(plant, false); }));
    document.getElementById("plants-empty").hidden = plants.length > 0;
  }

  function renderDashboard() {
    const today = dateOffset(0);
    const duePlants = plants.filter(function (plant) { return daysUntilWater(plant) <= 0; });
    const list = document.getElementById("today-list");
    const orderedPlants = plants.slice().sort(function (first, second) {
      return daysUntilWater(first) - daysUntilWater(second);
    });
    list.replaceChildren.apply(list, orderedPlants.map(function (plant) { return makePlantRow(plant, true); }));
    document.getElementById("plant-count").textContent = String(plants.length);
    document.getElementById("due-count").textContent = String(duePlants.length);
    document.getElementById("watered-count").textContent = String(plants.filter(function (plant) { return plant.lastWatered === today; }).length);
    document.getElementById("today-empty").hidden = plants.length > 0;
  }

  function makeSitterCard(sitter) {
    const card = createElement("article", "sitter-card");
    const avatar = createElement("span", "sitter-avatar", sitter.name.slice(0, 1));
    avatar.setAttribute("aria-hidden", "true");
    const area = createElement("span", "sitter-area", sitter.area);
    const name = createElement("h2", "", sitter.name);
    const specialty = createElement("p", "sitter-specialty", sitter.specialty);
    const availability = createElement("p", "sitter-availability", sitter.availability);
    const rate = createElement("p", "sitter-rate", "$" + sitter.rate + " ");
    rate.append(createElement("span", "", "per visit (sample)"));
    const requestButton = createElement("button", "button sitter-button", sitterRequests[sitter.id] ? "Cancel demo request" : "Request a visit");
    requestButton.type = "button";
    requestButton.setAttribute("aria-pressed", sitterRequests[sitter.id] ? "true" : "false");
    requestButton.addEventListener("click", function () {
      if (sitterRequests[sitter.id]) {
        delete sitterRequests[sitter.id];
      } else {
        sitterRequests[sitter.id] = true;
      }
      storage.set("sproutSitterRequests", sitterRequests);
      renderSitters();
    });
    card.append(avatar, area, name, specialty, availability, rate, requestButton);
    return card;
  }

  function renderSitters() {
    const list = document.getElementById("sitter-list");
    list.replaceChildren.apply(list, SITTERS.map(makeSitterCard));
  }

  document.getElementById("plant-form").addEventListener("submit", function (event) {
    event.preventDefault();
    const nameInput = document.getElementById("plant-name");
    const intervalInput = document.getElementById("plant-interval");
    plants.push({
      id: "plant-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      name: nameInput.value.trim(),
      interval: Number(intervalInput.value),
      lastWatered: dateOffset(0)
    });
    savePlants();
    nameInput.value = "";
    nameInput.focus();
  });

  renderPlants();
  renderDashboard();
  renderSitters();
  showView();
})();
