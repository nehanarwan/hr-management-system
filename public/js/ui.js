const NAV = {
  employee: [
    ['/employee/dashboard.html', 'Dashboard'],
    ['/employee/leave.html', 'My leave'],
    ['/employee/request.html', 'Request leave'],
    ['/employee/history.html', 'History'],
    ['/employee/calendar.html', 'Calendar'],
    ['/employee/profile.html', 'Profile'],
    ['/employee/chat.html', 'HR assistant'],
  ],
  manager: [
    ['/manager/dashboard.html', 'Dashboard'],
    ['/manager/leave-requests.html', 'Leave requests'],
    ['/manager/employees.html', 'My team'],
    ['/manager/approval-history.html', 'Approval history'],
    ['/manager/calendar.html', 'Team calendar'],
    ['/employee/leave.html', 'My own leave'],
    ['/employee/request.html', 'Request leave'],
    ['/manager/chat.html', 'HR assistant'],
  ],
  admin: [
    ['/admin/dashboard.html', 'Dashboard'],
    ['/admin/employees.html', 'Employees'],
    ['/admin/departments.html', 'Departments'],
    ['/admin/managers.html', 'Managers'],
    ['/admin/leave-policies.html', 'Leave policy'],
    ['/admin/company.html', 'Company'],
    ['/admin/settings.html', 'Settings'],
    ['/manager/leave-requests.html', 'Leave requests'],
    ['/employee/leave.html', 'My own leave'],
  ],
};

const ui = {

  layout(user, activePath) {
    const links = NAV[user.role] || NAV.employee;
    const app = document.createElement('div');
    app.className = 'app';

    const nav = links
      .map(([href, label]) => {
        const active = href === activePath ? ' class="active"' : '';
        return `<a href="${href}"${active}>${ui.escape(label)}</a>`;
      })
      .join('');

    app.innerHTML = `
      <aside class="sidebar">
        <div class="logo">${ui.escape(user.companyName || 'HR System')}<span>${ui.escape(user.role)} portal</span></div>
        <nav>${nav}</nav>
        <div class="spacer"></div>
        <div class="who">
          <strong>${ui.escape(user.firstName || '')} ${ui.escape(user.lastName || '')}</strong>
          ${ui.escape(user.email || '')}
          <button type="button" onclick="logout()">Sign out</button>
        </div>
      </aside>
      <main class="main" id="main"></main>
    `;

    document.body.innerHTML = '';
    document.body.appendChild(app);
    return document.getElementById('main');
  },

  head(title, subtitle, actionHtml) {
    return `
      <div class="page-head">
        <div>
          <h1>${ui.escape(title)}</h1>
          ${subtitle ? `<p>${ui.escape(subtitle)}</p>` : ''}
        </div>
        <div class="btn-row">${actionHtml || ''}</div>
      </div>`;
  },

  badge(status) {
    const key = String(status || '').toLowerCase();
    return `<span class="badge ${key}">${ui.escape(status)}</span>`;
  },

  stat(label, value, hint, highlight) {
    return `
      <div class="stat${highlight ? ' highlight' : ''}">
        <div class="label">${ui.escape(label)}</div>
        <div class="value">${ui.escape(String(value))}</div>
        ${hint ? `<div class="hint">${ui.escape(hint)}</div>` : ''}
      </div>`;
  },

  table(headers, rows, emptyMessage) {
    if (!rows.length) {
      return `<div class="empty">${ui.escape(emptyMessage || 'Nothing to show yet.')}</div>`;
    }
    const head = headers.map((h) => `<th>${ui.escape(h)}</th>`).join('');
    const body = rows.map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
    return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  },

  date(value) {
    if (!value) return '-';
    const d = new Date(value);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  },

  dateInput(value) {
    return value ? new Date(value).toISOString().slice(0, 10) : '';
  },

  range(from, to) {
    return `${ui.date(from)} &ndash; ${ui.date(to)}`;
  },

  alert(message, kind) {
    return `<div class="alert ${kind || 'info'}">${ui.escape(message)}</div>`;
  },

  toast(message, kind) {
    const main = document.getElementById('main') || document.body;
    const box = document.createElement('div');
    box.className = 'alert ' + (kind || 'ok');
    box.textContent = message;
    main.prepend(box);
    setTimeout(() => box.remove(), 4000);
  },

  modal(title, innerHtml, onSubmit) {
    const wrap = document.createElement('div');
    wrap.style.cssText =
      'position:fixed;inset:0;background:rgba(26,36,34,.45);display:flex;align-items:center;justify-content:center;padding:20px;z-index:50';
    wrap.innerHTML = `
      <form class="card" style="max-width:440px;width:100%;margin:0">
        <h2>${ui.escape(title)}</h2>
        <div id="modal-error"></div>
        ${innerHtml}
        <div class="btn-row" style="margin-top:16px">
          <button type="submit" class="btn">Save</button>
          <button type="button" class="btn secondary" data-close>Cancel</button>
        </div>
      </form>`;

    const close = () => wrap.remove();
    wrap.querySelector('[data-close]').onclick = close;
    wrap.onclick = (e) => { if (e.target === wrap) close(); };

    wrap.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const errorBox = wrap.querySelector('#modal-error');
      errorBox.innerHTML = '';
      try {
        await onSubmit(new FormData(e.target));
        close();
      } catch (err) {
        errorBox.innerHTML = ui.alert(err.message, 'error');
      }
    };

    document.body.appendChild(wrap);
  },

  escape(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  name(row) {
    return ui.escape(`${row.first_name || ''} ${row.last_name || ''}`.trim() || '-');
  },

  calendar(year, month, entries) {
    const first = new Date(Date.UTC(year, month, 1));
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const startOffset = (first.getUTCDay() + 6) % 7;
    const today = new Date().toISOString().slice(0, 10);

    const byDate = {};
    entries.forEach((entry) => {
      const start = new Date(entry.start_date);
      const end = new Date(entry.end_date);
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        byDate[key] = byDate[key] || [];
        byDate[key].push(`${entry.first_name} ${entry.last_name}`);
      }
    });

    const cells = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      .map((d) => `<div class="dow">${d}</div>`);

    for (let i = 0; i < startOffset; i += 1) cells.push('<div class="day other"></div>');

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(Date.UTC(year, month, day));
      const key = date.toISOString().slice(0, 10);
      const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
      const people = byDate[key] || [];
      const names = people.slice(0, 2).map((n) => `<div class="who">${ui.escape(n)}</div>`).join('');
      const more = people.length > 2 ? `<div class="who">+${people.length - 2} more</div>` : '';
      cells.push(
        `<div class="day${weekend ? ' weekend' : ''}${key === today ? ' today' : ''}">
           <div class="n">${day}</div>${names}${more}
         </div>`
      );
    }

    return `<div class="calendar">${cells.join('')}</div>`;
  },

  monthName(year, month) {
    return new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-GB', {
      month: 'long', year: 'numeric', timeZone: 'UTC',
    });
  },
};