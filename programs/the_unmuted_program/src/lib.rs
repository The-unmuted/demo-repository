use solana_program::{
    account_info::AccountInfo,
    declare_id,
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    pubkey::Pubkey,
};

declare_id!("BAnZZzYmRkonjWMS1Zhn8bbJrX8nNT9RMvhpKdeV722k");

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    _accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    if program_id != &id() {
        msg!("The Unmuted: incorrect program id");
        return Ok(());
    }

    match instruction_data.first().copied() {
        Some(0) => msg!("The Unmuted: SOS evidence anchor received"),
        Some(1) => msg!("The Unmuted: DAO privacy review checkpoint received"),
        Some(2) => msg!("The Unmuted: professional SBT review checkpoint received"),
        _ => msg!("The Unmuted: generic privacy-safe checkpoint received"),
    }

    msg!("The Unmuted: only hashes/checkpoints should be submitted on-chain");
    msg!("The Unmuted: payload bytes {}", instruction_data.len());
    Ok(())
}
