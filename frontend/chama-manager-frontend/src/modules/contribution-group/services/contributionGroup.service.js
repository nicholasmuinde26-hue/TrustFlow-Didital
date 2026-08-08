import contributionGroupApi from "../api/contributionGroup.api";

const contributionGroupService = {
  // Backend accepts { name, description, type, event_date, location,
  // visibility }. "type" here is the group's category (wedding, funeral,
  // fundraiser, ...) — see GROUP_TYPES — not the chama/contribution-group
  // workspace discriminator.
  async create(payload) {
    const { data } = await contributionGroupApi.create(payload);
    return data.data.group;
  },

  async get(groupId) {
    const { data } = await contributionGroupApi.get(groupId);
    return data.data;
  },

  async update(groupId, payload) {
    const { data } = await contributionGroupApi.update(groupId, payload);
    return data.data.group;
  },

  // organizer only — completed | cancelled | archived | active
  async updateStatus(groupId, status) {
    const { data } = await contributionGroupApi.updateStatus(groupId, status);
    return data.data.group;
  },
};

export default contributionGroupService;