# pulumi-azure-minecraft-server

Pulumi automation to deploy a Minecraft Server on Azure

This setup uses [pnpm](https://pnpm.io/) but feel free to use npm or yarn

# Prerequisites

- An Azure subscription
- A service principal with [Contributor role](https://docs.microsoft.com/azure/role-based-access-control/built-in-roles#contributor) at the subscription level.
- A Pulumi account and logged in via `pulumi login`

The following automation uses a `Standard_B2ms` virtual machine. See more information [here](https://docs.microsoft.com/en-us/azure/virtual-machines/sizes-b-series-burstable)

# Setup

> **Note:** Every command is run from the root directory

1. Install `node_modules`

   > As mentioned above I have opted for [pnpm](https://pnpm.io/) but replace `pnpm` with whatever package manager you wish to use

   ```bash
   pnpm install --dir ./src
   ```

2. Initialize a new stack in pulumi.

   ```bash
   pulumi stack init main --cwd ./src
   ```

3. Set up the pulumi configuration. Replace the temporary values with your configuration for Azure

   ```bash
   pulumi config set azure-native:location $LOCATION --cwd ./src
   pulumi config set azure-native:subscriptionId $SUBSCRIPTION_ID --cwd ./src
   pulumi config set azure-native:tenantId $TENANT_ID --cwd ./src
   pulumi config set azure-native:clientId $CLIENT_ID --cwd ./src
   pulumi config set --secret azure-native:clientSecret $CLIENT_SECRET --cwd ./src
   pulumi config set projectName $PROJECT_NAME --cwd ./src
   pulumi config set adminUsername $VM_USER_NAME --cwd ./src
   pulumi config set --secret adminPassword $VM_PASSWORD --cwd ./src
   ```

4. Run the pulumi automation

   ```bash
   pulumi up --yes --skip-preview --cwd ./src
   ```

5. Connect to the virtual machine via ssh

   > When the pulumi automation has finished you should see the `connection` variable as an output. This is the command you need to run in order to connect to your virtual machine. When prompted for your password enter the password you used for your configuration variable `adminPassword`

   ```bash
   ssh $USER@$IP_ADDRESS
   ```

6. Run the setup script and follow onscreen prompts to configure your virtual machine and run an ark server

   > If no map name parameter is provided the default is `TheIsland` you can see a list of map names [here](https://ark.fandom.com/wiki/Server_configuration#Map_names)

   ```bash
   sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/Jamess-Lucass/pulumi-azure-ark-server/bin/setup)" -s -- <Map-Name>
   ```

7. Copy the example configuration files and make any configuration changes

   ```bash
      cp ./config/example.GameUserSettings.ini ./config/GameUserSettings.ini
      cp ./config/example.Game.ini ./config/Game.ini
   ```

8. Copy server configuration files to the virtual machine

   > The server configuration files are located in the `/config` directory. You can copy them to the virtual machine using the following command

   ```bash
   scp .\config\Game*.ini $USER@$IP_ADDRESS:/datadrive/server/ShooterGame/Saved/Config/LinuxServer
   ```

9. Start the ARK server

   ```bash
   sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/Jamess-Lucass/pulumi-azure-ark-server/bin/start"
   ```

10. Connect to your ARK server

You may disable SSH Port in your NSG if you wish to not allow ssh connections to your virtual machine. Note that if you will need to turn this back on if you ever wish to ssh into your machine

# Useful commands

- Start your ARK server

  ```bash
  sudo systemctl start ark
  ```

- Stop your ARK server

  ```bash
  sudo systemctl stop ark
  ```
