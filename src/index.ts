import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";

const stack = pulumi.getStack();
const config = new pulumi.Config();
const projectName = config.get("projectName") ?? "server-01";

const adminUsername = config.require("adminUsername");
const adminPassword = config.requireSecret("adminPassword");

const resourceGroup = new azure_native.resources.ResourceGroup(
  "resource-group",
  {
    resourceGroupName: `RG-${projectName}-${stack}`,
  }
);

const virtualNetwork = new azure_native.network.VirtualNetwork(
  "virtual-network",
  {
    resourceGroupName: resourceGroup.name,
    addressSpace: {
      addressPrefixes: ["10.0.0.0/16"],
    },
    enableDdosProtection: false,
    virtualNetworkName: `VNET-${projectName}-${stack}`,
  },
  { dependsOn: [resourceGroup] }
);

const subnet = new azure_native.network.Subnet(
  "subnet",
  {
    resourceGroupName: resourceGroup.name,
    subnetName: "ark-server",
    virtualNetworkName: virtualNetwork.name,
    addressPrefix: "10.0.0.0/24",
    privateEndpointNetworkPolicies: "Enabled",
    privateLinkServiceNetworkPolicies: "Enabled",
  },
  {
    dependsOn: [resourceGroup, virtualNetwork],
  }
);

const nsgVM = new azure_native.network.NetworkSecurityGroup(
  "nsg-vm",
  {
    resourceGroupName: resourceGroup.name,
    networkSecurityGroupName: `NSG-${projectName}-${stack}`,
    securityRules: [
      {
        access: "Allow",
        destinationAddressPrefix: "*",
        destinationPortRange: "22",
        direction: "Inbound",
        name: "SSH",
        priority: 300,
        protocol: "TCP",
        sourceAddressPrefix: "*",
        sourcePortRange: "*",
      },
      {
        access: "Allow",
        destinationAddressPrefix: "*",
        destinationPortRange: "27015",
        direction: "Inbound",
        name: "Port_27015",
        priority: 290,
        protocol: "UDP",
        sourceAddressPrefix: "*",
        sourcePortRange: "*",
      },
      {
        access: "Allow",
        destinationAddressPrefix: "*",
        destinationPortRange: "7777",
        direction: "Inbound",
        name: "Port_7777",
        priority: 280,
        protocol: "UDP",
        sourceAddressPrefix: "*",
        sourcePortRange: "*",
      },
    ],
  },
  {
    dependsOn: [resourceGroup],
  }
);

const publicIPAddress = new azure_native.network.PublicIPAddress(
  "public-ip-address",
  {
    resourceGroupName: resourceGroup.name,
    idleTimeoutInMinutes: 4,
    publicIPAddressVersion: "IPv4",
    publicIPAllocationMethod: "Static",
    publicIpAddressName: `PIP-${projectName}-${stack}`,
    sku: {
      name: "Standard",
      tier: "Regional",
    },
    zones: ["1"],
  },
  {
    dependsOn: [resourceGroup],
  }
);

const nic = new azure_native.network.NetworkInterface(
  "nic",
  {
    resourceGroupName: resourceGroup.name,
    enableAcceleratedNetworking: false,
    enableIPForwarding: false,
    ipConfigurations: [
      {
        name: "ipconfig1",
        primary: true,
        privateIPAddressVersion: "IPv4",
        privateIPAllocationMethod: "Dynamic",
        publicIPAddress: {
          id: publicIPAddress.id,
        },
        subnet: {
          id: subnet.id,
        },
      },
    ],
    networkInterfaceName: `NIC-${projectName}-${stack}`,
    networkSecurityGroup: {
      id: nsgVM.id,
    },
    nicType: "Standard",
  },
  {
    dependsOn: [resourceGroup, publicIPAddress, subnet, nsgVM],
  }
);

const disk01 = new azure_native.compute.Disk(
  "disk-01",
  {
    resourceGroupName: resourceGroup.name,
    creationData: {
      createOption: "Empty",
    },
    diskIOPSReadWrite: 240,
    diskMBpsReadWrite: 50,
    diskName: `DISK-${projectName}-01-${stack}`,
    diskSizeGB: 64,
    encryption: {
      type: "EncryptionAtRestWithPlatformKey",
    },
    networkAccessPolicy: "AllowAll",
    sku: {
      name: "Premium_LRS",
    },
    tier: "P6",
    zones: ["1"],
  },
  {
    dependsOn: [resourceGroup],
  }
);

const virtualMachine = new azure_native.compute.VirtualMachine(
  "virtual-machine",
  {
    resourceGroupName: resourceGroup.name,
    vmName: `VM-${projectName}-${stack}`,
    diagnosticsProfile: {
      bootDiagnostics: {
        enabled: true,
      },
    },
    hardwareProfile: {
      vmSize: "Standard_B2ms",
    },
    networkProfile: {
      networkInterfaces: [
        {
          deleteOption: "Detach",
          id: nic.id,
        },
      ],
    },
    osProfile: {
      adminUsername: adminUsername,
      adminPassword: adminPassword,
      allowExtensionOperations: true,
      computerName: "ark-server",
      linuxConfiguration: {
        disablePasswordAuthentication: false,
        patchSettings: {
          assessmentMode: "ImageDefault",
          patchMode: "ImageDefault",
        },
        provisionVMAgent: true,
      },
    },
    storageProfile: {
      dataDisks: [
        {
          caching: azure_native.compute.CachingTypes.None,
          createOption: "Attach",
          deleteOption: "Detach",
          lun: 0,
          managedDisk: {
            id: disk01.id,
            storageAccountType: "Premium_LRS",
          },
          toBeDetached: false,
          writeAcceleratorEnabled: false,
        },
      ],
      imageReference: {
        offer: "0001-com-ubuntu-server-focal",
        publisher: "canonical",
        sku: "20_04-lts-gen2",
        version: "latest",
      },
      osDisk: {
        caching: azure_native.compute.CachingTypes.ReadWrite,
        createOption: "FromImage",
        deleteOption: "Delete",
        diskSizeGB: 30,
        managedDisk: {
          storageAccountType: "Premium_LRS",
        },
        name: `DISK-${projectName}-OS-${stack}`,
        osType: azure_native.compute.OperatingSystemTypes.Linux,
      },
    },
    zones: ["1"],
  },
  {
    dependsOn: [resourceGroup, nic, disk01],
  }
);

export const publicIP = publicIPAddress.ipAddress;
export const connection = publicIPAddress.ipAddress.apply(
  (ip) => `ssh ${adminUsername}@${ip}`
);
