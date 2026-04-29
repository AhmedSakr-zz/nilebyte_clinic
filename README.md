### NileByte Clinic

NileByte clinic-specific features for ClinicWiser tenants. 

**About this App:**
This is a custom Frappe app used to add specific business functionality and features to our Frappe server. By maintaining these custom features in this app, we can easily install it on any newly created site (e.g., new ClinicWiser tenants) to instantly provision our business logic and extensions.

### Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch develop
bench install-app nilebyte_clinic
```

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/nilebyte_clinic
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

### License

mit
