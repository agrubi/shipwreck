
/**
 * Convert a JSON object into a URL encoded parameter string.
 * Usefull for sending data in a query string, or as form parameters
 */
const _urlencode = data => {
  return Object
    .keys(data)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join('&');
}

/** Convert a string to a DOM node */
const _html = str => {
  const template = document.createElement('template');
  template.innerHTML = str.trim();
  return template.content.firstChild;
}

/** helpers for generating HTML markup */
const markup = {

  code(json) {
    return `<pre><code>${JSON.stringify(json, null, 2)}</code></pre>`;
  },

  card(item) {
    if (item instanceof SirenEntity)
      return markup.entityCard(item);
    else if (item instanceof SirenLink)
      return markup.linkCard(item);
    else if (item instanceof SirenAction)
      return markup.actionCard(item);
    else
      return '';
  },

  // Entities

  entityCard(entity) {
    return `
      <div class="card">
        <div class="head">
          <div><label>class:</label> [ ${entity.class.join(', ')} ]</div>
          <div><label>rel:</label> [ ${entity.rel.join(', ')} ]</div>
        </div>
        <div class="body">
          <div><label>title:</label> ${entity.title}</div>
          <label>links:</label>
          <ul>
          ${entity.links.map(l => `<li>${markup.linkAnchor(l)}</li>`).join('\n')}
          </ul>
          <div class="entity-properties entity-raw">
            <label>properties:</label>
            ${markup.code(entity.properties)}
          </div>
          <div class="entity-actions">
            <label>actions:</label>
            ${entity.actions.map(markup.actionForm).join('\n')}
          </div>
        </div>
      </div>
    `;
  },

  // Links

  linkAnchor(link) {
    const rels = link.rel.map(rel => `<a href="#${link.href}">${rel}</a>`).join(', ');
    return `[ ${rels} ] <a href="#${link.href}">${link.title}</a>`;
  },

  linkCard(link) {
    return `
      <div class="card">
        <div class="head">
          <div><label>rel:</label> [ ${link.rel.join(', ')} ]</div>
          <div><label>href:</label> ${link.href}</div>
        </div>
      </div>
    `;
  },

  // Actions

  actionForm(action) {
    return `
      <form
        name="${action.name}"
        type="${action.type}"
        action="${action.href}"
        method="${action.method}"
        onsubmit="return false;">
        <h3>${action.name}</h3>
        <div class="form-fields">
          ${action.fields.map(markup.fieldForm).join('\n')}
        </div>
        <input type="submit" value="submit">
        <p class="entity-action-href">${action.method} ${action.href}</p>
      </form>
    `;
  },

  fieldForm(field) {
    switch (field.type) {
      case 'hidden':
        return `<input type="${field.type}" value="${field.value}" name="${field.name}">`;

      default:
        return `
          <div class="form-field">
            <label>${field.name}</label>
            <input type="${field.type}" value="${field.value}" name="${field.name}">
          </div>
          `;
    }
  },

  actionCard(action) {
    return `
      <div class="card">
        ${markup.actionForm(action)}
      </div>
    `;
  },

  // Main Container

  ship(entity, target, formSubmitHandler) {
    target.innerHTML = `
      <div class="shipwreck">

        <!-- Display the current location in a nice clickable manner -->
        <div class="current-path"></div>

        <!-- Tabs to switch between raw and pretty views -->
        <div class="tabs">
          <a name="content-entity">Entity</a>
          <a name="content-raw">Raw</a>
        </div>

        <!-- Pretty view of an entity -->
        <div class="content" id="content-entity">
          <div class="flex-parent">
            <div class="flex-1">

              <div class="entity-class" ${entity.class.length === 0 ? 'hidden': ''}>
                <h2>Class</h2>
                [ ${entity.class.join(', ')} ]
              </div>

              <div class="entity-links" ${entity.links.length === 0 ? 'hidden': ''}>
                <h2>Links</h2>
                ${entity.links.map(l => `<div>${markup.linkAnchor(l)}</div>`).join('\n')}
              </div>

              <div class="entity-properties" ${Object.keys(entity.properties).length === 0 ? 'hidden': ''}>
                <h2>Properties</h2>
                <table><tbody></tbody></table>
              </div>

              <div class="entity-actions">
                <h2>Actions</h2>
                ${entity.actions.map(markup.card).join('\n')}
              </div>

            </div>
            <div class="flex-2" ${entity.entities.length === 0 ? 'hidden': ''}>

              <div class="entity-entities">
                <h2>Entities</h2>
              </div>

            </div>
          </div>
        </div>

        <!-- Raw JSON entity object -->
        <div class="content" id="content-raw">
          <div class="entity-raw">${markup.code(entity.raw)}</div>
        </div>

      </div>
    `;

    // Tabs
    const contents = target.querySelectorAll('.shipwreck > .content');
    const tabs = target.querySelectorAll('.shipwreck > .tabs > a');
    tabs.forEach(tab => {
      tab.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        contents.forEach(c => c.style.display = c.id === tab.name ? 'block' : 'none');
      };
    });
    tabs[0].click();

    // Current path
    const link = entity.link('self');
    if (link) {
      const url = new URL(link.href);
      const parts = url.pathname.split('/').filter(i => i);
      let href = url.origin;
      target.querySelector('.current-path').innerHTML = `
          <a href="#${href}">${href}</a> /
          ${parts.map(p => `<a href="#${href = href + '/' + p}">${p}</a>`).join(' / \n')}
      `;
    }

    // Display the Properties
    const tbody = target.querySelector('.entity-properties tbody');
    const rows = Object
      .keys(entity.properties)
      .forEach(k => tbody.appendChild(_html(`
        <tr>
          <td class="key">${k}:</td>
          <td class="value">${entity.properties[k]}</td>
        </tr>`
      )));

    const formFix = e => {
      return form => {
        const action = e.action(form.getAttribute('name'));
        if (!action) return;
        form.onsubmit = () => {
          const data = {};
          action.fields.forEach(f => data[f.name] = form.elements[f.name].value);
          formSubmitHandler && formSubmitHandler({ entity: e, action, data });
          return false; // prevent browser from following form.action
        };
      };
    };

    // intercept form submission
    target.querySelectorAll('.entity-actions form').forEach(formFix(entity));

    // sub entities
    const parent = target.querySelector('.entity-entities');
    entity.entities.forEach(e => {
      const card = _html(markup.card(e));
      parent.appendChild(card);
      // intercept form submission
      card.querySelectorAll('.entity-actions form').forEach(formFix(e));
      // toggle body visibility when head is clicked
      const body = card.querySelector('.body');
      const head = card.querySelector('.head');
      head.onclick = () =>  body.style.display = body.style.display === 'block' ? 'none' : 'block';
    });
  },

};
