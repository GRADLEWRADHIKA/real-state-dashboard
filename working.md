# EstateFlow: signing in (production)

How each person signs in to the **dashboard** (website for office staff) and the **app** (Android, for field staff and customers) once EstateFlow is live.

There are **no demo logins in production**. The one-tap demo accounts (`admin@demo.com` and so on) exist only when the backend runs in demo mode. Every real login is created by your administrator, and nobody can sign themselves up.

## Who signs in where

| Person | Designation to pick | Dashboard | App | What they see |
|---|---|---|---|---|
| Owner / Director | Director | Yes | Yes | Everything |
| General Manager | General Manager | Yes | Yes | Everything |
| Sales Manager | Sales Manager | Yes | Yes | The whole sales team's leads, customers, brokers, attendance and targets. No accounts. |
| Accountant | Accountant | Yes | Yes | Money only: payments, receipts, expenses, salaries, broker commission |
| Sales Executive / Sales Person | Sales Person | Yes | Yes | Only their own leads, follow-ups, site visits and customers |
| Telecaller | Telecaller | Yes | Yes | Only their own leads and customers |
| Customer (buyer) | Customer | **No** | Yes | Their own plot, payments, receipts, documents and requests |

Director and General Manager have full administrator access, on the dashboard and in the app.

## 1. The very first login (administrator)

The first administrator is created automatically when the backend starts on an empty database. The login comes from the backend's settings (on Render: the **Environment** tab):

| Setting | Example |
|---|---|
| `ADMIN_EMAIL` | `admin@starwizrealty.com` |
| `ADMIN_PASSWORD` | a strong password: at least 8 characters, with an uppercase letter and a number |
| `ADMIN_NAME` | `Administrator` |

1. Open the dashboard address (for example `https://starwiz-crm.netlify.app`). Visitors see the public website, so click **Staff login** at the top right.
2. Enter `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then click **Sign in**.
3. Go to **Settings → Change password** and choose a new password that only you know.
4. Go to **Settings → Company profile** and fill in the company details.

## 2. Creating logins for staff

Only an **administrator** (Director or General Manager) can create logins.

1. On the dashboard, open **Users & roles → Add user**.
2. Enter the person's **name**, **email** (this is their username) and **phone**.
3. Pick their **Designation**: Director, General Manager, Sales Manager, Accountant, Sales Person or Telecaller. The access level follows automatically.
4. Type a **first password** (at least 8 characters, with an uppercase letter and a number) and click **Save**.
5. Give the person their email, password, the dashboard address and the app (APK) privately. Ask them to change the password after the first sign-in (dashboard: **Settings → Change password**; app: **Profile → Change password**).

To stop someone signing in (for example when they leave), set them to **Inactive** on Users & roles. They are signed out everywhere at once.

## 3. Creating a login for a customer

A customer can sign in only to the **app**, and only after they are booked as a customer.

1. Book them first. Either convert the lead (**Leads → the lead → Convert to customer**) or add a direct booking on **Customers**.
2. Open **Users & roles → Add user**, choose **Customer**, and pick their **Customer record**.
3. Enter their email and a first password, then click **Save**.
4. Send the customer the APK (or the Play Store link) with their email and password.

Each customer record can have one app login. If a customer tries the dashboard, they see a message telling them to use the app.

## 4. Signing in to the dashboard

For office staff (Director, GM, Sales Manager, Accountant, Sales Person, Telecaller):

1. Open the dashboard address in Chrome or Edge.
2. Click **Staff login**.
3. Enter your **email** and **password**.
4. Tick **Keep me signed in** on your own computer only. Leave it off on shared computers.
5. Click **Sign in**. You land on your home screen: the Dashboard, or Finance overview for accountants.

## 5. Signing in to the app

For field staff and customers:

1. Install the APK. Open the file on the phone and allow **Install unknown apps** once, or install from the Play Store.
2. Open **EstateFlow**.
3. If the app asks for a **server address**, type the backend address you were given (for example `https://api.starwizrealty.com`). It is asked only once, and you can change it later from **This server** on the sign-in screen.
4. Enter your **email** and **password**.
5. Leave **Keep me signed in on this phone** ticked on your own phone. The app then stays signed in for 30 days of use.
6. Tap **Sign in**.
   - **Staff** land on **My day**. Tap **Check in** for attendance.
   - **Customers** land on **Home** with their plot, payments and registry status.
7. Optional: turn on **Fingerprint unlock** in **Profile**.

## 6. Forgotten password

Nobody, including the administrator, can see a password. A forgotten password is replaced with a one-time code:

1. On the sign-in screen (dashboard or app), tap **Forgot password?**, enter your email and send the request.
2. An administrator (or the Sales Manager, for sales staff and customers) opens **Password resets** on the dashboard and clicks **Issue code**. They pass the code to the person by phone or in person.
3. The person enters the code with a new password on the sign-in screen and signs in.

An administrator can also issue a code directly from **Users & roles** without waiting for a request.

## 7. Locked out

After **5 wrong passwords** in a row, the account locks for **15 minutes**. Wait, or ask an administrator to click **Unlock** on Users & roles. These limits can be changed in **Settings → Security**.

## Password rules

- At least 8 characters, with at least one uppercase letter and one number (adjustable in Settings → Security).
- Everyone has their own login. Never share one between people, because every action is recorded under the person who signed in.
- Dashboard sessions end after 12 hours unless **Keep me signed in** was ticked (adjustable in Settings → Security).
- Lost a phone? In the app, **Profile → Sign out → Sign out on every device** ends all your sessions. An administrator can do the same for anyone with **Sign out everywhere** on Users & roles.

## Trying things out safely (demo)

To practise without touching real data, run the backend in demo mode on a computer (`npm run dev:demo` in `estateflow-backend`). Its sign-in screens show these one-tap logins, which **never work in production**:

| Role | Email | Password |
|---|---|---|
| Administrator | admin@demo.com | Admin@123 |
| Sales Manager | manager@demo.com | Manager@123 |
| Sales Executive | sales@demo.com | Sales@123 |
| Accounts | accounts@demo.com | Accounts@123 |
| Customer | customer@demo.com | Customer@123 |
