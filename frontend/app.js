const API_BASE_URL = '';
const STORAGE_KEY = 'people-ledger-employees';

const sampleEmployees = [
  {
    employeeId: 'EMP-1001',
    name: 'Maya Patel',
    email: 'maya.patel@example.com',
    department: 'Engineering',
    designation: 'Platform Lead',
    joiningDate: '2022-04-18'
  },
  {
    employeeId: 'EMP-1002',
    name: 'Jon Bell',
    email: 'jon.bell@example.com',
    department: 'Operations',
    designation: 'Operations Manager',
    joiningDate: '2023-09-04'
  }
];

let employees = loadEmployees();
let editingEmployeeId = null;

const elements = {
  list: document.querySelector('#employee-list'),
  emptyState: document.querySelector('#empty-state'),
  search: document.querySelector('#search-input'),
  form: document.querySelector('#employee-form'),
  dialog: document.querySelector('#employee-dialog'),
  dialogTitle: document.querySelector('#dialog-title'),
  formError: document.querySelector('#form-error'),
  toast: document.querySelector('#toast'),
  status: document.querySelector('#connection-status'),
  employeeId: document.querySelector('#employee-id'),
  count: document.querySelector('#employee-count'),
  departmentCount: document.querySelector('#department-count'),
  latestDate: document.querySelector('#latest-joining-date'),
  visibleCount: document.querySelector('#visible-count')
};

function loadEmployees() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : sampleEmployees;
}

function persistEmployees() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));
}

function formatDate(dateString) {
  if (!dateString) return '—';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${dateString}T00:00:00`));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
}

function render() {
  const query = elements.search.value.trim().toLowerCase();
  const visibleEmployees = employees.filter(employee =>
    [employee.name, employee.email, employee.department, employee.designation]
      .some(value => value.toLowerCase().includes(query))
  );

  elements.list.innerHTML = visibleEmployees.map(employee => `
    <tr>
      <td><span class="employee-name">${escapeHtml(employee.name)}</span><span class="employee-email">${escapeHtml(employee.email)}</span></td>
      <td>${escapeHtml(employee.department)}</td>
      <td>${escapeHtml(employee.designation)}</td>
      <td>${formatDate(employee.joiningDate)}</td>
      <td><div class="actions"><button class="action-button" data-action="edit" data-id="${employee.employeeId}" type="button">Edit</button><button class="action-button delete" data-action="delete" data-id="${employee.employeeId}" type="button">Delete</button></div></td>
    </tr>
  `).join('');

  elements.emptyState.hidden = visibleEmployees.length > 0;
  elements.visibleCount.textContent = `${visibleEmployees.length} ${visibleEmployees.length === 1 ? 'record' : 'records'}`;
  elements.count.textContent = employees.length;
  elements.departmentCount.textContent = new Set(employees.map(employee => employee.department)).size;
  elements.latestDate.textContent = employees.length ? formatDate([...employees].sort((a, b) => b.joiningDate.localeCompare(a.joiningDate))[0].joiningDate) : '—';
}

function openForm(employee = null) {
  editingEmployeeId = employee ? employee.employeeId : null;
  elements.dialogTitle.textContent = employee ? 'Edit employee' : 'Add employee';
  elements.formError.textContent = '';
  elements.form.reset();
  elements.employeeId.value = employee?.employeeId || '';
  if (employee) {
    Object.entries(employee).forEach(([key, value]) => {
      const field = elements.form.elements[key === 'employeeId' ? 'employeeId' : key];
      if (field) field.value = value;
    });
  }
  elements.dialog.showModal();
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  return response.status === 204 ? null : response.json();
}

async function saveEmployee(employee) {
  if (API_BASE_URL) {
    const path = editingEmployeeId ? `/employees/${editingEmployeeId}` : '/employees';
    await request(path, { method: editingEmployeeId ? 'PUT' : 'POST', body: JSON.stringify(employee) });
    employees = await request('/employees');
  } else {
    if (editingEmployeeId) {
      employees = employees.map(item => item.employeeId === editingEmployeeId ? employee : item);
    } else {
      employees = [...employees, employee];
    }
    persistEmployees();
  }
}

async function deleteEmployee(employeeId) {
  if (!window.confirm('Delete this employee record?')) return;
  if (API_BASE_URL) {
    await request(`/employees/${employeeId}`, { method: 'DELETE' });
    employees = await request('/employees');
  } else {
    employees = employees.filter(employee => employee.employeeId !== employeeId);
    persistEmployees();
  }
  render();
  showToast('Employee record deleted');
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');
  window.setTimeout(() => elements.toast.classList.remove('visible'), 2600);
}

elements.form.addEventListener('submit', async event => {
  event.preventDefault();
  const data = new FormData(elements.form);
  const employee = {
    employeeId: editingEmployeeId || `EMP-${Date.now().toString().slice(-6)}`,
    name: data.get('name').trim(),
    email: data.get('email').trim(),
    department: data.get('department').trim(),
    designation: data.get('designation').trim(),
    joiningDate: data.get('joiningDate')
  };

  try {
    await saveEmployee(employee);
    elements.dialog.close();
    render();
    showToast(editingEmployeeId ? 'Employee record updated' : 'Employee added to the directory');
  } catch (error) {
    elements.formError.textContent = error.message;
  }
});

document.querySelector('#new-employee-button').addEventListener('click', () => openForm());
document.querySelector('#empty-add-button').addEventListener('click', () => openForm());
document.querySelector('#close-dialog-button').addEventListener('click', () => elements.dialog.close());
document.querySelector('#cancel-button').addEventListener('click', () => elements.dialog.close());
elements.search.addEventListener('input', render);
elements.list.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const employee = employees.find(item => item.employeeId === button.dataset.id);
  if (button.dataset.action === 'edit') openForm(employee);
  if (button.dataset.action === 'delete') deleteEmployee(button.dataset.id);
});

if (API_BASE_URL) {
  elements.status.classList.add('api-mode');
  elements.status.innerHTML = '<span class="status-dot"></span> API connected';
  request('/employees').then(data => { employees = data; render(); }).catch(() => showToast('Could not load employees from the API'));
}

render();
